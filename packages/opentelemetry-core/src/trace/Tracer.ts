/**
 * Copyright 2019, OpenTelemetry Authors
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

import * as uuid from 'uuid';
import * as types from '@opentelemetry/types';
import { BaseScopeManager } from '@opentelemetry/scope-base';
import { ALWAYS_SAMPLER } from './sampler/ProbabilitySampler';
import { NoopSpan } from './NoopSpan';
import { NoopLogger } from '../common/NoopLogger';

/**
 * This class represents a tracer.
 */
export class Tracer implements types.Tracer {
  static INVALID_ID = '0';

  private logger!: types.Logger;
  private sampler!: types.Sampler;
  private scopeManager?: BaseScopeManager;
  private defaultAttributes?: types.Attributes;

  // TODO: consume invalid span context from `SpanContext.INVALID`
  static defaultSpan = new NoopSpan({
    traceId: Tracer.INVALID_ID,
    // TODO: consume invalid `spanId` from `Span.INVALID`
    spanId: '0',
    traceOptions: types.TraceOptions.UNSAMPLED,
  });

  /**
   * Constructs a new Tracer instance.
   */
  constructor(config: types.TracerConfig = {}) {
    this.sampler = config.sampler || ALWAYS_SAMPLER;
    this.scopeManager = config.scopeManager;
    this.defaultAttributes = config.defaultAttributes;
    this.logger = config.logger || new NoopLogger();
  }

  /**
   * Starts a new Span or returns the default NoopSpan based on the sampling
   * decision.
   */
  startSpan(name: string, options: types.SpanOptions = {}): types.Span {
    let parentSpanContext: types.SpanContext | undefined;
    // parent is a SpanContext
    if (
      options.parent &&
      typeof (options.parent as types.SpanContext).traceId
    ) {
      parentSpanContext = options.parent as types.SpanContext;
    }
    // parent is a Span
    if (
      options.parent &&
      typeof (options.parent as types.Span).context === 'function'
    ) {
      parentSpanContext = (options.parent as types.Span).context();
    }

    // make sampling decision
    if (!this.sampler.shouldSample(parentSpanContext)) {
      return Tracer.defaultSpan;
    }

    // span context
    const traceId = parentSpanContext
      ? parentSpanContext.traceId
      : generateTraceId();

    // TODO: generate span id in a browser compatible way
    const spanId = '';

    // TODO: create a real Span
    const span = new NoopSpan({
      traceId,
      spanId,
    });

    // Set default attributes
    if (this.defaultAttributes) {
      span.setAttributes(this.defaultAttributes);
    }

    return span;
  }

  /**
   * Returns the current Span from the current context.
   */
  getCurrentSpan(): types.Span {
    // Return with defaultSpan if no scope manager provided.
    if (!this.scopeManager) {
      this.logger.warn(
        'getCurrentSpan() returns an invalid default span without a scopeManager'
      );
      return Tracer.defaultSpan;
    }

    // Get the current Span from the context.
    return this.scopeManager.active() as types.Span;
  }

  /**
   * Enters the scope of code where the given Span is in the current context.
   */
  withSpan<T extends (...args: unknown[]) => ReturnType<T>>(
    span: types.Span,
    fn: T
  ): ReturnType<T> {
    if (!this.scopeManager) {
      this.logger.warn('withSpan(...) has no effect without a scopeManager');
      return fn();
    }

    // Set given span to context.
    return this.scopeManager.with(span, fn);
  }

  /**
   * Records a SpanData.
   */
  recordSpanData(span: types.Span): void {
    // TODO: notify exporter
  }

  /**
   * Returns the binary format interface which can serialize/deserialize Spans.
   */
  getBinaryFormat(): unknown {
    // TODO: get binary format form propagation
    throw new Error('Method not implemented.');
  }

  /**
   * Returns the HTTP text format interface which can inject/extract Spans.
   */
  getHttpTextFormat(): unknown {
    // TODO: get binary format form propagation
    throw new Error('Method not implemented.');
  }
}

/**
 * Generates a new trace id.
 */
function generateTraceId(): string {
  // TODO: revisit algorithm, copied from OpenCensus for now
  // TODO: move to utils
  return uuid
    .v4()
    .split('-')
    .join('');
}
