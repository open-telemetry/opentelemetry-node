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

import * as api from '@opentelemetry/api';
import * as opentracing from 'opentracing';
import {
  SpanAttributes,
  SpanAttributeValue,
  SpanStatusCode,
  TextMapPropagator,
} from '@opentelemetry/api';

function translateReferences(references: opentracing.Reference[]): api.Link[] {
  const links: api.Link[] = [];
  for (const reference of references) {
    const context = reference.referencedContext();
    if (context instanceof SpanContextShim) {
      links.push({
        context: (context as SpanContextShim).getSpanContext(),
        attributes: { 'span.kind': reference.type() },
      });
    }
  }
  return links;
}

function translateSpanOptions(
  options: opentracing.SpanOptions
): api.SpanOptions {
  const opts: api.SpanOptions = {
    startTime: options.startTime,
  };

  if (options.references) {
    opts.links = translateReferences(options.references);
  }

  return opts;
}

function getContextWithParent(options: opentracing.SpanOptions) {
  if (options.childOf) {
    if (options.childOf instanceof SpanShim) {
      return api.trace.setSpan(api.context.active(), options.childOf.getSpan());
    } else if (options.childOf instanceof SpanContextShim) {
      return api.trace.setSpanContext(
        api.context.active(),
        options.childOf.getSpanContext()
      );
    }
  }
  return api.context.active();
}

/**
 * SpanContextShim wraps a {@link api.SpanContext} and implements the
 * OpenTracing span context API.
 */
export class SpanContextShim extends opentracing.SpanContext {
  private readonly _spanContext: api.SpanContext;
  private _baggage: api.Baggage;

  constructor(spanContext: api.SpanContext, baggage: api.Baggage) {
    super();
    this._spanContext = spanContext;
    this._baggage = baggage;
  }

  /**
   * Returns the underlying {@link api.SpanContext}
   */
  getSpanContext(): api.SpanContext {
    return this._spanContext;
  }

  /**
   * Returns the underlying {@link api.Baggage}
   */
  getBaggage(): api.Baggage {
    return this._baggage;
  }

  /**
   * Returns the trace ID as a string.
   */
   override toTraceId(): string {
    return this._spanContext.traceId;
  }

  /**
   * Returns the span ID as a string.
   */
   override toSpanId(): string {
    return this._spanContext.spanId;
  }

  getBaggageItem(key: string): string | undefined {
    return this._baggage.getEntry(key)?.value;
  }

  setBaggageItem(key: string, value: string) {
    this._baggage = this._baggage.setEntry(key, { value });
  }
}

/**
 * TracerShim wraps a {@link api.Tracer} and implements the
 * OpenTracing tracer API.
 */
export class TracerShim extends opentracing.Tracer {
  private readonly _tracer: api.Tracer;
  private readonly _propagators: ShimPropagators | undefined;

  constructor(tracer: api.Tracer, propagators?: ShimPropagators) {
    super();

    this._tracer = tracer;
    this._propagators = propagators;
  }

  override startSpan(
    name: string,
    options: opentracing.SpanOptions = {}
  ): opentracing.Span {
    const span = this._tracer.startSpan(
      name,
      translateSpanOptions(options),
      getContextWithParent(options)
    );

    let baggage: api.Baggage = api.propagation.createBaggage();
    if (options.childOf instanceof SpanShim) {
      const shimContext = options.childOf.context() as SpanContextShim;
      baggage = shimContext.getBaggage();
    } else if (options.childOf instanceof SpanContextShim) {
      baggage = options.childOf.getBaggage();
    }

    if (options.tags) {
      span.setAttributes(options.tags);
    }

    return new SpanShim(this, span, baggage);
  }

  override _inject(
    spanContext: opentracing.SpanContext,
    format: string,
    carrier: unknown
  ): void {
    const spanContextShim: SpanContextShim = spanContext as SpanContextShim;
    const oTelSpanContext: api.SpanContext = spanContextShim.getSpanContext();
    const oTelSpanBaggage: api.Baggage = spanContextShim.getBaggage();

    if (!carrier || typeof carrier !== 'object') return;

    if (format === opentracing.FORMAT_BINARY) {
      api.diag.warn('OpentracingShim.inject() does not support FORMAT_BINARY');
      // @todo: Implement binary format
      return;
    }

    const propagator = this._getPropagator(format);
    if (propagator !== undefined) {
      const context = api.propagation.setBaggage(
        api.trace.setSpanContext(api.ROOT_CONTEXT, oTelSpanContext),
        oTelSpanBaggage
      );
      propagator.inject(context, carrier, api.defaultTextMapSetter);
    }
  }

  override _extract(format: string, carrier: unknown): opentracing.SpanContext | null {
    if (format === opentracing.FORMAT_BINARY) {
      api.diag.warn('OpentracingShim.extract() does not support FORMAT_BINARY');
      // @todo: Implement binary format
      return null;
    }

    const propagator = this._getPropagator(format);
    if (propagator !== undefined) {
      const context: api.Context = propagator.extract(
        api.ROOT_CONTEXT,
        carrier,
        api.defaultTextMapGetter
      );
      const spanContext = api.trace.getSpanContext(context);
      const baggage = api.propagation.getBaggage(context);

      if (!spanContext) {
        return null;
      }
      return new SpanContextShim(spanContext, baggage || api.propagation.createBaggage());
    }
    return null;
  }

  private _getPropagator(format: string): api.TextMapPropagator | undefined {
    switch (format) {
      case opentracing.FORMAT_TEXT_MAP:
        return this._propagators?.textMapPropagator ?? api.propagation;
      case opentracing.FORMAT_HTTP_HEADERS:
        return this._propagators?.httpHeadersPropagator ?? api.propagation;
      default:
        return;
    }
  }
}

/**
 * SpanShim wraps an {@link api.Span} and implements the OpenTracing Span API
 * around it.
 *
 **/
export class SpanShim extends opentracing.Span {
  // _span is the original OpenTelemetry span that we are wrapping with
  // an opentracing interface.
  private readonly _span: api.Span;
  private readonly _contextShim: SpanContextShim;
  private readonly _tracerShim: TracerShim;

  constructor(tracerShim: TracerShim, span: api.Span, baggage: api.Baggage) {
    super();
    this._span = span;
    this._contextShim = new SpanContextShim(span.spanContext(), baggage);
    this._tracerShim = tracerShim;
  }

  /**
   * Returns a reference to the Span's context.
   *
   * @returns a {@link SpanContextShim} containing the underlying context.
   */
  override context(): opentracing.SpanContext {
    return this._contextShim;
  }

  /**
   * Returns the {@link opentracing.Tracer} that created the span.
   */
  override tracer(): opentracing.Tracer {
    return this._tracerShim;
  }

  /**
   * Updates the underlying span's name.
   *
   * @param name the Span name.
   */
  override setOperationName(name: string): this {
    this._span.updateName(name);
    return this;
  }

  /**
   * Finishes the span. Once the span is finished, no new updates can be applied
   * to the span.
   *
   * @param finishTime An optional timestamp to explicitly set the span's end time.
   */
  override finish(finishTime?: number): void {
    this._span.end(finishTime);
  }

  /**
   * Logs an event with an optional payload.
   * @param eventName name of the event.
   * @param payload an arbitrary object to be attached to the event.
   */
  override logEvent(eventName: string, payload?: SpanAttributes): void {
    this._span.addEvent(eventName, payload);
  }

  /**
   * Logs a set of key value pairs. Since OpenTelemetry only supports events,
   * the KV pairs are used as attributes on an event named "log".
   */
 override log(keyValuePairs: SpanAttributes, _timestamp?: number): this {
    // @todo: Handle timestamp
    this._span.addEvent('log', keyValuePairs);
    return this;
  }

  /**
   * Adds a set of tags to the span.
   * @param keyValueMap set of KV pairs representing tags
   */
  override addTags(keyValueMap: SpanAttributes): this {
    for (const [key, value] of Object.entries(keyValueMap)) {
      if (this._setErrorAsSpanStatusCode(key, value)) {
        continue;
      }
      if (value !== undefined) {
        this._span.setAttribute(key, value);
      }
    }
    return this;
  }

  /**
   * Sets a tag on the span, updating the value if the key is already present
   * on the span.
   * @param key key for the tag
   * @param value value for the tag
   */
  override setTag(key: string, value: SpanAttributeValue): this {
    if (this._setErrorAsSpanStatusCode(key, value)) {
      return this;
    }

    this._span.setAttribute(key, value);
    return this;
  }

  override getBaggageItem(key: string): string | undefined {
    return this._contextShim.getBaggageItem(key);
  }

  override setBaggageItem(key: string, value: string): this {
    this._contextShim.setBaggageItem(key, value);
    return this;
  }

  /**
   * Returns the underlying {@link api.Span} that the shim
   * is wrapping.
   */
  getSpan(): api.Span {
    return this._span;
  }

  private _setErrorAsSpanStatusCode(
    key: string,
    value: SpanAttributeValue | undefined
  ): boolean {
    if (key === opentracing.Tags.ERROR) {
      const statusCode = SpanShim._mapErrorTag(value);
      this._span.setStatus({ code: statusCode });
      return statusCode !== SpanStatusCode.UNSET;
    }
    return false;
  }

  private static _mapErrorTag(
    value: SpanAttributeValue | undefined
  ): SpanStatusCode {
    switch (value) {
      case true:
      case 'true':
        return SpanStatusCode.ERROR;
      case false:
      case 'false':
        return SpanStatusCode.OK;
      default:
        return SpanStatusCode.UNSET;
    }
  }
}

/**
 * Propagator configuration for the {@link TracerShim}
 */
export interface ShimPropagators {
  textMapPropagator?: TextMapPropagator;
  httpHeadersPropagator?: TextMapPropagator;
}
