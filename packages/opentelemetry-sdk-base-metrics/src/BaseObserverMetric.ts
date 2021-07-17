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
import * as api from '@opentelemetry/api-metrics';
import { InstrumentationLibrary } from '@opentelemetry/core';
import { Resource } from '@opentelemetry/resources';
import { BoundObserver } from './BoundInstrument';
import { Processor } from './export/Processor';
import { MetricKind, MetricRecord } from './export/types';
import { Metric } from './Metric';
import { ObserverResult } from './ObserverResult';

const NOOP_CALLBACK = () => {};

/**
 * This is a SDK implementation of Base Observer Metric.
 * All observers should extend this class
 */
export abstract class BaseObserverMetric
  extends Metric<BoundObserver>
  implements api.BaseObserver {
  protected _callback: (observerResult: api.ObserverResult) => unknown;

  constructor(
    name: string,
    options: api.MetricOptions,
    private readonly _processor: Processor,
    resource: Resource,
    metricKind: MetricKind,
    instrumentationLibrary: InstrumentationLibrary,
    callback?: (observerResult: api.ObserverResult) => unknown
  ) {
    super(name, options, metricKind, resource, instrumentationLibrary);
    this._callback = callback || NOOP_CALLBACK;
  }

  protected _makeInstrument(labels: api.Labels): BoundObserver {
    return new BoundObserver(
      labels,
      this._disabled,
      this._valueType,
      this._processor.aggregatorFor(this._descriptor)
    );
  }

  override async getMetricRecord(): Promise<MetricRecord[]> {
    const observerResult = new ObserverResult();
    await this._callback(observerResult);

    this._processResults(observerResult);

    return super.getMetricRecord();
  }

  protected _processResults(observerResult: ObserverResult) {
    observerResult.values.forEach((value, labels) => {
      const instrument = this.bind(labels);
      instrument.update(value);
    });
  }

  observation(value: number) {
    return {
      value,
      observer: this as BaseObserverMetric,
    };
  }
}
