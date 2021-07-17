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
  Aggregator,
  MetricDescriptor,
  MetricRecord,
  Processor,
} from '@opentelemetry/sdk-base-metrics';

type Constructor<T, R extends Aggregator> = new (...args: T[]) => R;

export class ExactProcessor<T, R extends Aggregator> extends Processor {
  private readonly args: ConstructorParameters<Constructor<T, R>>;
  public aggregators: R[] = [];

  constructor(
    private readonly aggregator: Constructor<T, R>,
    ...args: ConstructorParameters<Constructor<T, R>>
  ) {
    super();
    this.args = args;
  }

  aggregatorFor(metricDescriptor: MetricDescriptor): Aggregator {
    const aggregator = new this.aggregator(...this.args);
    this.aggregators.push(aggregator);
    return aggregator;
  }

  process(record: MetricRecord): void {
    const labels = Object.keys(record.labels)
      .map(k => `${k}=${record.labels[k]}`)
      .join(',');
    this._batchMap.set(record.descriptor.name + labels, record);
  }
}
