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
import {
  IdGenerator,
  InstrumentationLibrary,
  RandomIdGenerator,
  sanitizeAttributes,
} from '@opentelemetry/core';
import { Resource } from '@opentelemetry/resources';
import { BasicTracerProvider } from './BasicTracerProvider';
import { Span } from './Span';
import { SpanLimits, TracerConfig } from './types';
import { mergeConfig } from './utility';

/**
 * This class represents a basic tracer.
 */
export class Tracer implements api.Tracer {
  private readonly _sampler: api.Sampler;
  private readonly _spanLimits: SpanLimits;
  private readonly _idGenerator: IdGenerator;
  readonly resource: Resource;
  readonly instrumentationLibrary: InstrumentationLibrary;

  /**
   * Constructs a new Tracer instance.
   */
  constructor(
    instrumentationLibrary: InstrumentationLibrary,
    config: TracerConfig,
    private _tracerProvider: BasicTracerProvider
  ) {
    const localConfig = mergeConfig(config);
    this._sampler = localConfig.sampler;
    this._spanLimits = localConfig.spanLimits;
    this._idGenerator = config.idGenerator || new RandomIdGenerator();
    this.resource = _tracerProvider.resource;
    this.instrumentationLibrary = instrumentationLibrary;
  }

  /**
   * Starts a new Span or returns the default NoopSpan based on the sampling
   * decision.
   */
  startSpan(
    name: string,
    options: api.SpanOptions = {},
    context = api.context.active()
  ): api.Span {
    if (api.isInstrumentationSuppressed(context)) {
      api.diag.debug('Instrumentation suppressed, returning Noop Span');
      return api.NOOP_TRACER.startSpan(name, options, context);
    }

    const parentContext = getParent(options, context);
    const spanId = this._idGenerator.generateSpanId();
    let traceId;
    let traceState;
    let parentSpanId;
    if (!parentContext || !api.trace.isSpanContextValid(parentContext)) {
      // New root span.
      traceId = this._idGenerator.generateTraceId();
    } else {
      // New child span.
      traceId = parentContext.traceId;
      traceState = parentContext.traceState;
      parentSpanId = parentContext.spanId;
    }

    const spanKind = options.kind ?? api.SpanKind.INTERNAL;
    const links = options.links ?? [];
    const attributes = sanitizeAttributes(options.attributes);
    // make sampling decision
    const samplingResult = this._sampler.shouldSample(
      options.root
        ? api.setSpanContext(context, api.INVALID_SPAN_CONTEXT)
        : context,
      traceId,
      name,
      spanKind,
      attributes,
      links
    );

    const traceFlags =
      samplingResult.decision === api.SamplingDecision.RECORD_AND_SAMPLED
        ? api.TraceFlags.SAMPLED
        : api.TraceFlags.NONE;
    const spanContext = { traceId, spanId, traceFlags, traceState };
    if (samplingResult.decision === api.SamplingDecision.NOT_RECORD) {
      api.diag.debug('Recording is off, starting no recording span');
      return api.NOOP_TRACER.startSpan(
        name,
        options,
        api.setSpanContext(context, spanContext)
      );
    }

    const span = new Span(
      this,
      context,
      name,
      spanContext,
      spanKind,
      parentSpanId,
      links,
      options.startTime
    );
    // Set default attributes
    span.setAttributes(Object.assign(attributes, samplingResult.attributes));
    return span;
  }

  /** Returns the active {@link SpanLimits}. */
  getSpanLimits(): SpanLimits {
    return this._spanLimits;
  }

  getActiveSpanProcessor() {
    return this._tracerProvider.getActiveSpanProcessor();
  }
}

/**
 * Get the parent to assign to a started span. If options.parent is null,
 * do not assign a parent.
 *
 * @param options span options
 * @param context context to check for parent
 */
function getParent(
  options: api.SpanOptions,
  context: api.Context
): api.SpanContext | undefined {
  if (options.root) return undefined;
  return api.getSpanContext(context);
}
