/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Context,
  SpanContext,
  TextMapGetter,
  TextMapPropagator,
  TextMapSetter,
  propagation,
  trace,
  TraceFlags,
} from '@opentelemetry/api';
import { isTracingSuppressed } from '@opentelemetry/core';

export const UBER_TRACE_ID_HEADER = 'uber-trace-id';
export const UBER_BAGGAGE_HEADER_PREFIX = 'uberctx';
const UBER_BAGGAGE_HEADER_REGEX = /^uberctx-(.+)/i;

/**
 * Propagates {@link SpanContext} through Trace Context format propagation.
 * {trace-id}:{span-id}:{parent-span-id}:{flags}
 * {trace-id}
 * 64-bit or 128-bit random number in base16 format.
 * Can be variable length, shorter values are 0-padded on the left.
 * Value of 0 is invalid.
 * {span-id}
 * 64-bit random number in base16 format.
 * {parent-span-id}
 * Set to 0 because this field is deprecated.
 * {flags}
 * One byte bitmap, as two hex digits.
 * Inspired by jaeger-client-node project.
 */
export class JaegerPropagator implements TextMapPropagator {
  private readonly _jaegerTraceHeader: string;

  /**
   * @param {string} [customTraceHeader="uber-trace-id"] - HTTP header to inject\extract trace from.
   **/
  constructor(customTraceHeader?: string) {
    this._jaegerTraceHeader = customTraceHeader || UBER_TRACE_ID_HEADER;
  }

  inject(context: Context, carrier: unknown, setter: TextMapSetter) {
    const spanContext = trace.getSpanContext(context);
    const baggage = propagation.getBaggage(context);
    if (spanContext && isTracingSuppressed(context) === false) {
      const traceFlags = `0${(
        spanContext.traceFlags || TraceFlags.NONE
      ).toString(16)}`;

      setter.set(
        carrier,
        this._jaegerTraceHeader,
        `${spanContext.traceId}:${spanContext.spanId}:0:${traceFlags}`
      );
    }

    if (baggage) {
      for (const [key, entry] of baggage.getAllEntries()) {
        setter.set(
          carrier,
          `${UBER_BAGGAGE_HEADER_PREFIX}-${key}`,
          encodeURIComponent(entry.value)
        );
      }
    }
  }

  extract(context: Context, carrier: unknown, getter: TextMapGetter): Context {
    const uberTraceIdHeader = getter.get(carrier, this._jaegerTraceHeader);
    const uberTraceId = Array.isArray(uberTraceIdHeader)
      ? uberTraceIdHeader[0]
      : uberTraceIdHeader;
    const baggageValues = getter
      .keys(carrier)
      .filter(key => UBER_BAGGAGE_HEADER_REGEX.test(key))
      .map(key => {
        const value = getter.get(carrier, key);
        return {
          key: key.substring(UBER_BAGGAGE_HEADER_PREFIX.length + 1),
          value: Array.isArray(value) ? value[0] : value,
        };
      });

    let newContext = context;
    // if the trace id header is present and valid, inject it into the context
    if (typeof uberTraceId === 'string') {
      const spanContext = deserializeSpanContext(uberTraceId);
      if (spanContext) {
        newContext = trace.setSpanContext(newContext, spanContext);
      }
    }
    if (baggageValues.length === 0) return newContext;

    // if baggage values are present, inject it into the current baggage
    let currentBaggage = propagation.getBaggage(context) ?? propagation.createBaggage();
    for (const baggageEntry of baggageValues) {
      if (baggageEntry.value === undefined) continue;
      currentBaggage = currentBaggage.setEntry(baggageEntry.key, {
        value: decodeURIComponent(baggageEntry.value),
      });
    }
    newContext = propagation.setBaggage(newContext, currentBaggage);

    return newContext;
  }

  fields(): string[] {
    return [this._jaegerTraceHeader];
  }
}

/**
 * @param {string} serializedString - a serialized span context.
 * @return {SpanContext} - returns a span context represented by the serializedString.
 **/
function deserializeSpanContext(serializedString: string): SpanContext | null {
  const headers = decodeURIComponent(serializedString).split(':');
  if (headers.length !== 4) {
    return null;
  }

  const [_traceId, spanId, , flags] = headers;

  const traceId = _traceId.padStart(32, '0');
  const traceFlags = flags.match(/^[0-9a-f]{2}$/i) ? parseInt(flags) & 1 : 1;

  return { traceId, spanId, isRemote: true, traceFlags };
}
