/*!
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

import * as api from '@opentelemetry/api';
import { ConsoleLogger } from '@opentelemetry/core';
import { Resource } from '@opentelemetry/resources';
import { BatchObserverMetric } from './BatchObserverMetric';
import { BaseBoundInstrument } from './BoundInstrument';
import { CounterMetric } from './CounterMetric';
import { MetricRecord } from './export/types';
import { ValueRecorderMetric } from './ValueRecorderMetric';
import { Metric } from './Metric';
import { ObserverMetric } from './ObserverMetric';
import { DEFAULT_METRIC_OPTIONS, DEFAULT_CONFIG, MeterConfig } from './types';
import { Batcher, UngroupedBatcher } from './export/Batcher';
import { PushController } from './export/Controller';
import { NoopExporter } from './export/NoopExporter';

/**
 * Meter is an implementation of the {@link Meter} interface.
 */
export class Meter implements api.Meter {
  private readonly _logger: api.Logger;
  private readonly _metrics = new Map<string, Metric<BaseBoundInstrument>>();
  private readonly _batcher: Batcher;
  private readonly _resource: Resource;

  /**
   * Constructs a new Meter instance.
   */
  constructor(config: MeterConfig = DEFAULT_CONFIG) {
    this._logger = config.logger || new ConsoleLogger(config.logLevel);
    this._batcher = config.batcher ?? new UngroupedBatcher();
    this._resource = config.resource || Resource.createTelemetrySDKResource();
    // start the push controller
    const exporter = config.exporter || new NoopExporter();
    const interval = config.interval;
    new PushController(this, exporter, interval);
  }

  /**
   * Creates and returns a new {@link ValueRecorder}.
   * @param name the name of the metric.
   * @param [options] the metric options.
   */
  createValueRecorder(
    name: string,
    options?: api.MetricOptions
  ): api.ValueRecorder {
    if (!this._isValidName(name)) {
      this._logger.warn(
        `Invalid metric name ${name}. Defaulting to noop metric implementation.`
      );
      return api.NOOP_VALUE_RECORDER_METRIC;
    }
    const opt: api.MetricOptions = {
      absolute: true, // value recorders are defined as absolute by default
      monotonic: false, // not applicable to value recorder, set to false
      logger: this._logger,
      ...DEFAULT_METRIC_OPTIONS,
      ...options,
    };

    const valueRecorder = new ValueRecorderMetric(
      name,
      opt,
      this._batcher,
      this._resource
    );
    this._registerMetric(name, valueRecorder);
    return valueRecorder;
  }

  /**
   * Creates a new counter metric. Generally, this kind of metric when the
   * value is a quantity, the sum is of primary interest, and the event count
   * and value distribution are not of primary interest.
   * @param name the name of the metric.
   * @param [options] the metric options.
   */
  createCounter(name: string, options?: api.MetricOptions): api.Counter {
    if (!this._isValidName(name)) {
      this._logger.warn(
        `Invalid metric name ${name}. Defaulting to noop metric implementation.`
      );
      return api.NOOP_COUNTER_METRIC;
    }
    const opt: api.MetricOptions = {
      monotonic: true, // Counters are defined as monotonic by default
      absolute: false, // not applicable to counter, set to false
      logger: this._logger,
      ...DEFAULT_METRIC_OPTIONS,
      ...options,
    };
    const counter = new CounterMetric(name, opt, this._batcher, this._resource);
    this._registerMetric(name, counter);
    return counter;
  }

  /**
   * Creates a new observer metric.
   * @param name the name of the metric.
   * @param [options] the metric options.
   * @param [callback] the batch observer callback
   */
  createObserver(
    name: string,
    options: api.MetricOptions = {},
    callback?: (observerResult: api.ObserverResult) => void
  ): api.Observer {
    if (!this._isValidName(name)) {
      this._logger.warn(
        `Invalid metric name ${name}. Defaulting to noop metric implementation.`
      );
      return api.NOOP_OBSERVER_METRIC;
    }
    const opt: api.MetricOptions = {
      monotonic: false, // Observers are defined as non-monotonic by default
      absolute: false, // not applicable to observer, set to false
      logger: this._logger,
      ...DEFAULT_METRIC_OPTIONS,
      ...options,
    };
    const observer = new ObserverMetric(
      name,
      opt,
      this._batcher,
      this._resource,
      callback
    );
    this._registerMetric(name, observer);
    return observer;
  }

  /**
   * Creates a new batch observer metric.
   * @param name the name of the metric.
   * @param callback the batch observer callback
   * @param [options] the metric batch options.
   * @param [maxTimeoutUpdateMS] indicates how long should the batch metric
   *     should wait to update
   */
  createBatchObserver(
    name: string,
    callback: (observerResult: api.BatchObserverResult) => void,
    options: api.BatchMetricOptions = {}
  ): api.BatchObserver {
    if (!this._isValidName(name)) {
      this._logger.warn(
        `Invalid metric name ${name}. Defaulting to noop metric implementation.`
      );
      return api.NOOP_OBSERVER_METRIC;
    }
    const opt: api.BatchMetricOptions = {
      monotonic: false, // Observers are defined as non-monotonic by default
      absolute: false, // not applicable to observer, set to false
      logger: this._logger,
      ...DEFAULT_METRIC_OPTIONS,
      ...options,
    };
    const observer = new BatchObserverMetric(
      name,
      opt,
      this._batcher,
      this._resource,
      callback
    );
    this._registerMetric(name, observer);
    return observer;
  }

  /**
   * Collects all the metrics created with this `Meter` for export.
   *
   * Utilizes the batcher to create checkpoints of the current values in
   * each aggregator belonging to the metrics that were created with this
   * meter instance.
   */
  collect(): Promise<undefined> {
    return new Promise((resolve, reject) => {
      const metrics: Promise<MetricRecord[]>[] = [];
      Array.from(this._metrics.values()).forEach(metric => {
        metrics.push(metric.getMetricRecord());
      });
      Promise.all(metrics)
        .then(records => {
          records.forEach(metrics => {
            metrics.forEach(metric => this._batcher.process(metric));
          });
          resolve();
        })
        .catch(reject);
    });
  }

  getBatcher(): Batcher {
    return this._batcher;
  }

  /**
   * Registers metric to register.
   * @param name The name of the metric.
   * @param metric The metric to register.
   */
  private _registerMetric<T extends BaseBoundInstrument>(
    name: string,
    metric: Metric<T>
  ): void {
    if (this._metrics.has(name)) {
      this._logger.error(
        `A metric with the name ${name} has already been registered.`
      );
      return;
    }
    this._metrics.set(name, metric);
  }

  /**
   * Ensure a metric name conforms to the following rules:
   *
   * 1. They are non-empty strings
   *
   * 2. The first character must be non-numeric, non-space, non-punctuation
   *
   * 3. Subsequent characters must be belong to the alphanumeric characters, '_', '.', and '-'.
   *
   * Names are case insensitive
   *
   * @param name Name of metric to be created
   */
  private _isValidName(name: string): boolean {
    return Boolean(name.match(/^[a-z][a-z0-9_.-]*$/i));
  }
}
