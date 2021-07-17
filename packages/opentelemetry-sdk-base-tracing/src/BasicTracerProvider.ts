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
  TracerProvider,
  trace,
  context,
  propagation,
  TextMapPropagator,
  diag,
} from '@opentelemetry/api';
import {
  CompositePropagator,
  HttpBaggagePropagator,
  HttpTraceContextPropagator,
  getEnv,
} from '@opentelemetry/core';
import { Resource } from '@opentelemetry/resources';
import { SpanProcessor, Tracer } from '.';
import { DEFAULT_CONFIG } from './config';
import { MultiSpanProcessor } from './MultiSpanProcessor';
import { NoopSpanProcessor } from './export/NoopSpanProcessor';
import { SDKRegistrationConfig, TracerConfig } from './types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const merge = require('lodash.merge');
import { SpanExporter } from './export/SpanExporter';
import { BatchSpanProcessor } from './platform';

export type PROPAGATOR_FACTORY = () => TextMapPropagator;
export type EXPORTER_FACTORY = () => SpanExporter;

export enum ForceFlushState {
  'resolved',
  'timeout',
  'error',
  'unresolved',
}

/**
 * This class represents a basic tracer provider which platform libraries can extend
 */
export class BasicTracerProvider implements TracerProvider {
  protected static readonly _registeredPropagators = new Map<
    string,
    PROPAGATOR_FACTORY
  >([
    ['tracecontext', () => new HttpTraceContextPropagator()],
    ['baggage', () => new HttpBaggagePropagator()],
  ]);

  protected static readonly _registeredExporters = new Map<
    string,
    EXPORTER_FACTORY
  >();

  private readonly _config: TracerConfig;
  private readonly _registeredSpanProcessors: SpanProcessor[] = [];
  private readonly _tracers: Map<string, Tracer> = new Map();

  activeSpanProcessor: SpanProcessor;
  readonly resource: Resource;

  constructor(config: TracerConfig = {}) {
    const mergedConfig = merge({}, DEFAULT_CONFIG, config);
    this.resource = mergedConfig.resource ?? Resource.empty();
    this.resource = Resource.default().merge(this.resource);
    this._config = Object.assign({}, mergedConfig, {
      resource: this.resource,
    });

    const defaultExporter = this._buildExporterFromEnv();
    if (defaultExporter !== undefined) {
      const batchProcessor = new BatchSpanProcessor(defaultExporter);
      this.activeSpanProcessor = batchProcessor;
    } else {
      this.activeSpanProcessor = new NoopSpanProcessor();
    }
  }

  getTracer(name: string, version?: string): Tracer {
    const key = `${name}@${version || ''}`;
    if (!this._tracers.has(key)) {
      this._tracers.set(key, new Tracer({ name, version }, this._config, this));
    }

    return this._tracers.get(key)!;
  }

  /**
   * Adds a new {@link SpanProcessor} to this tracer.
   * @param spanProcessor the new SpanProcessor to be added.
   */
  addSpanProcessor(spanProcessor: SpanProcessor): void {
    if (this._registeredSpanProcessors.length === 0) {
      // since we might have enabled by default a batchProcessor, we disable it
      // before adding the new one
      this.activeSpanProcessor
        .shutdown()
        .catch(err =>
          diag.error(
            'Error while trying to shutdown current span processor',
            err
          )
        );
    }
    this._registeredSpanProcessors.push(spanProcessor);
    this.activeSpanProcessor = new MultiSpanProcessor(
      this._registeredSpanProcessors
    );
  }

  getActiveSpanProcessor(): SpanProcessor {
    return this.activeSpanProcessor;
  }

  /**
   * Register this TracerProvider for use with the OpenTelemetry API.
   * Undefined values may be replaced with defaults, and
   * null values will be skipped.
   *
   * @param config Configuration object for SDK registration
   */
  register(config: SDKRegistrationConfig = {}) {
    trace.setGlobalTracerProvider(this);
    if (config.propagator === undefined) {
      config.propagator = this._buildPropagatorFromEnv();
    }

    if (config.contextManager) {
      context.setGlobalContextManager(config.contextManager);
    }

    if (config.propagator) {
      propagation.setGlobalPropagator(config.propagator);
    }
  }

  forceFlush(): Promise<void> {
    const timeout = this._config.forceFlushTimeoutMillis;
    const promises = this._registeredSpanProcessors.map(
      (spanProcessor: SpanProcessor) => {
        return new Promise(resolve => {
          let state: ForceFlushState;
          const timeoutInterval = setTimeout(() => {
            resolve(
              new Error(
                `Span processor did not completed within timeout period of ${timeout} ms`
              )
            );
            state = ForceFlushState.timeout;
          }, timeout);

          spanProcessor
            .forceFlush()
            .then(() => {
              clearTimeout(timeoutInterval);
              if (state !== ForceFlushState.timeout) {
                state = ForceFlushState.resolved;
                resolve(state);
              }
            })
            .catch(error => {
              clearTimeout(timeoutInterval);
              state = ForceFlushState.error;
              resolve(error);
            });
        });
      }
    );

    return new Promise<void>((resolve, reject) => {
      Promise.all(promises)
        .then(results => {
          const errors = results.filter(
            result => result !== ForceFlushState.resolved
          );
          if (errors.length > 0) {
            reject(errors);
          } else {
            resolve();
          }
        })
        .catch(error => reject([error]));
    });
  }

  shutdown() {
    return this.activeSpanProcessor.shutdown();
  }

  protected _getPropagator(name: string): TextMapPropagator | undefined {
    return BasicTracerProvider._registeredPropagators.get(name)?.();
  }

  protected _getSpanExporter(name: string): SpanExporter | undefined {
    return BasicTracerProvider._registeredExporters.get(name)?.();
  }

  protected _buildPropagatorFromEnv(): TextMapPropagator | undefined {
    // per spec, propagators from env must be deduplicated
    const uniquePropagatorNames = Array.from(
      new Set(getEnv().OTEL_PROPAGATORS)
    );

    const propagators = uniquePropagatorNames.map(name => {
      const propagator = this._getPropagator(name);
      if (!propagator) {
        diag.warn(
          `Propagator "${name}" requested through environment variable is unavailable.`
        );
      }

      return propagator;
    });
    const validPropagators = propagators.reduce<TextMapPropagator[]>(
      (list, item) => {
        if (item) {
          list.push(item);
        }
        return list;
      },
      []
    );

    if (validPropagators.length === 0) {
      return;
    } else if (uniquePropagatorNames.length === 1) {
      return validPropagators[0];
    } else {
      return new CompositePropagator({
        propagators: validPropagators,
      });
    }
  }

  protected _buildExporterFromEnv(): SpanExporter | undefined {
    const exporterName = getEnv().OTEL_TRACES_EXPORTER;
    if (exporterName === 'none') return;
    const exporter = this._getSpanExporter(exporterName);
    if (!exporter) {
      diag.error(
        `Exporter "${exporterName}" requested through environment variable is unavailable.`
      );
    }
    return exporter;
  }
}
