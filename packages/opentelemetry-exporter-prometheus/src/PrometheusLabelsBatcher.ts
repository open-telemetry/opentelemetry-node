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
  MetricRecord,
  MetricDescriptor,
  AggregatorKind,
} from '@opentelemetry/sdk-base-metrics';
import { PrometheusCheckpoint } from './types';

interface BatcherCheckpoint {
  descriptor: MetricDescriptor;
  aggregatorKind: AggregatorKind;
  records: Map<string, MetricRecord>;
}

export class PrometheusLabelsBatcher {
  private _batchMap = new Map<string, BatcherCheckpoint>();

  get hasMetric() {
    return this._batchMap.size > 0;
  }

  process(record: MetricRecord) {
    const name = record.descriptor.name;
    let item = this._batchMap.get(name);
    if (item === undefined) {
      item = {
        descriptor: record.descriptor,
        aggregatorKind: record.aggregator.kind,
        records: new Map(),
      };
      this._batchMap.set(name, item);
    }
    const recordMap = item.records;
    const labels = Object.keys(record.labels)
      .map(k => `${k}=${record.labels[k]}`)
      .join(',');
    recordMap.set(labels, record);
  }

  checkPointSet(): PrometheusCheckpoint[] {
    return Array.from(this._batchMap.values()).map(
      ({ descriptor, aggregatorKind, records }) => {
        return {
          descriptor,
          aggregatorKind,
          records: Array.from(records.values()),
        };
      }
    );
  }
}
