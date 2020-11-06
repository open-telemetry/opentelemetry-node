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
  ConsoleLogger,
  InstrumentationLibrary,
  NoRecordingSpan,
  IdGenerator,
  RandomIdGenerator,
  sanitizeAttributes,
} from '@opentelemetry/core';
import { Resource } from '@opentelemetry/resources';
import { BasicTracerProvider } from './BasicTracerProvider';
import { Span } from './Span';
import { TraceParams, TracerConfig } from './types';
import { mergeConfig } from './utility';

/**
 * This class represents a basic tracer.
 */
export class Tracer implements api.Tracer {
  private readonly _sampler: api.Sampler;
  private readonly _traceParams: TraceParams;
  private readonly _idGenerator: IdGenerator;
  readonly resource: Resource;
  readonly instrumentationLibrary: InstrumentationLibrary;
  readonly logger: api.Logger;

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
    this._traceParams = localConfig.traceParams;
    this._idGenerator = config.idGenerator || new RandomIdGenerator();
    this.resource = _tracerProvider.resource;
    this.instrumentationLibrary = instrumentationLibrary;
    this.logger = config.logger || new ConsoleLogger(config.logLevel);

    const configuredAttributeLimit =
      this._traceParams.spanAttributeValueSizeLimit || null;
    if (configuredAttributeLimit !== null && configuredAttributeLimit < 32) {
      this.logger.warn(
        'OTEL_SPAN_ATTRIBUTE_VALUE_SIZE_LIMIT was set to a value lower than 32, which is not allowed, limit of 32 will be applied.'
      );
      this._traceParams.spanAttributeValueSizeLimit = 32;
    }
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
      this.logger.debug('Instrumentation suppressed, returning Noop Span');
      return api.NOOP_SPAN;
    }

    const parentContext = getParent(options, context);
    const spanId = this._idGenerator.generateSpanId();
    let traceId;
    let traceState;
    if (!parentContext || !api.trace.isSpanContextValid(parentContext)) {
      // New root span.
      traceId = this._idGenerator.generateTraceId();
    } else {
      // New child span.
      traceId = parentContext.traceId;
      traceState = parentContext.traceState;
    }

    const spanKind = options.kind ?? api.SpanKind.INTERNAL;
    const links = options.links ?? [];
    const attributes = sanitizeAttributes(options.attributes);
    // make sampling decision
    const samplingResult = this._sampler.shouldSample(
      context,
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
      this.logger.debug('Recording is off, starting no recording span');
      return new NoRecordingSpan(spanContext);
    }

    const span = new Span(
      this,
      context,
      name,
      spanContext,
      spanKind,
      parentContext ? parentContext.spanId : undefined,
      links,
      options.startTime
    );
    // Set default attributes
    span.setAttributes(Object.assign(attributes, samplingResult.attributes));
    return span;
  }

  /**
   * Returns the current Span from the current context.
   *
   * If there is no Span associated with the current context, undefined is returned.
   */
  getCurrentSpan(): api.Span | undefined {
    const ctx = api.context.active();
    // Get the current Span from the context or null if none found.
    return api.getActiveSpan(ctx);
  }

  /**
   * Enters the context of code where the given Span is in the current context.
   */
  withSpan<T extends (...args: unknown[]) => ReturnType<T>>(
    span: api.Span,
    fn: T
  ): ReturnType<T> {
    // Set given span to context.
    return api.context.with(api.setActiveSpan(api.context.active(), span), fn);
  }

  /**
   * Bind a span (or the current one) to the target's context
   */
  bind<T>(target: T, span?: api.Span): T {
    return api.context.bind(
      target,
      span
        ? api.setActiveSpan(api.context.active(), span)
        : api.context.active()
    );
  }

  /** Returns the active {@link TraceParams}. */
  getActiveTraceParams(): TraceParams {
    return this._traceParams;
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
  return api.getParentSpanContext(context);
}
