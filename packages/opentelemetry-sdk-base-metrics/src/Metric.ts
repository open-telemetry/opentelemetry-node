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
import { BaseBoundInstrument } from './BoundInstrument';
import { MetricDescriptor, MetricKind, MetricRecord } from './export/types';
import { hashLabels } from './Utils';

/** This is a SDK implementation of {@link Metric} interface. */
export abstract class Metric<T extends BaseBoundInstrument>
  implements api.UnboundMetric<T> {
  protected readonly _disabled: boolean;
  protected readonly _valueType: api.ValueType;
  protected readonly _descriptor: MetricDescriptor;
  protected readonly _boundaries: number[] | undefined;
  protected readonly _aggregationTemporality: api.AggregationTemporality;
  private readonly _instruments: Map<string, T> = new Map();

  constructor(
    private readonly _name: string,
    private readonly _options: api.MetricOptions,
    private readonly _kind: MetricKind,
    readonly resource: Resource,
    readonly instrumentationLibrary: InstrumentationLibrary
  ) {
    this._disabled = !!_options.disabled;
    this._valueType =
      typeof _options.valueType === 'number'
        ? _options.valueType
        : api.ValueType.DOUBLE;
    this._boundaries = _options.boundaries;
    this._descriptor = this._getMetricDescriptor();
    this._aggregationTemporality =
      _options.aggregationTemporality === undefined
        ? api.AggregationTemporality.AGGREGATION_TEMPORALITY_CUMULATIVE
        : _options.aggregationTemporality;
  }

  /**
   * Returns an Instrument associated with specified Labels.
   * It is recommended to keep a reference to the Instrument instead of always
   * calling this method for each operation.
   * @param labels key-values pairs that are associated with a specific metric
   *     that you want to record.
   */
  bind(labels: api.Labels): T {
    const hash = hashLabels(labels);
    if (this._instruments.has(hash)) return this._instruments.get(hash)!;

    const instrument = this._makeInstrument(labels);
    this._instruments.set(hash, instrument);
    return instrument;
  }

  /**
   * Removes the Instrument from the metric, if it is present.
   * @param labels key-values pairs that are associated with a specific metric.
   */
  unbind(labels: api.Labels): void {
    this._instruments.delete(hashLabels(labels));
  }

  /**
   * Clears all Instruments from the Metric.
   */
  clear(): void {
    this._instruments.clear();
  }

  /**
   * Returns kind of metric
   */
  getKind(): MetricKind {
    return this._kind;
  }

  getAggregationTemporality() {
    return this._aggregationTemporality;
  }

  getMetricRecord(): Promise<MetricRecord[]> {
    return new Promise(resolve => {
      resolve(
        Array.from(this._instruments.values()).map(instrument => ({
          descriptor: this._descriptor,
          labels: instrument.getLabels(),
          aggregator: instrument.getAggregator(),
          aggregationTemporality: this.getAggregationTemporality(),
          resource: this.resource,
          instrumentationLibrary: this.instrumentationLibrary,
        }))
      );
    });
  }

  private _getMetricDescriptor(): MetricDescriptor {
    return {
      name: this._name,
      description: this._options.description || '',
      unit: this._options.unit || '1',
      metricKind: this._kind,
      valueType: this._valueType,
      ...(this._boundaries && { boundaries: this._boundaries }),
    };
  }

  protected abstract _makeInstrument(labels: api.Labels): T;
}
