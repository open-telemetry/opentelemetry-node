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
import * as assert from 'assert';
import { PrometheusLabelsBatcher } from '../src/PrometheusLabelsBatcher';
import {
  CounterMetric,
  AggregatorKind,
  MeterProvider,
  Meter,
} from '@opentelemetry/sdk-base-metrics';
import { Labels } from '@opentelemetry/api-metrics';

describe('PrometheusBatcher', () => {
  let meter: Meter;
  before(() => {
    meter = new MeterProvider({}).getMeter('test');
  });

  describe('constructor', () => {
    it('should construct a batcher', () => {
      const batcher = new PrometheusLabelsBatcher();
      assert(batcher instanceof PrometheusLabelsBatcher);
    });
  });

  describe('process', () => {
    it('should aggregate metric records with same metric name', async () => {
      const batcher = new PrometheusLabelsBatcher();
      const counter = meter.createCounter('test_counter') as CounterMetric;
      counter.bind({ val: '1' }).add(1);
      counter.bind({ val: '2' }).add(1);

      const records = await counter.getMetricRecord();
      records.forEach(it => batcher.process(it));

      const checkPointSet = batcher.checkPointSet();
      assert.strictEqual(checkPointSet.length, 1);
      assert.strictEqual(checkPointSet[0].descriptor.name, 'test_counter');
      assert.strictEqual(checkPointSet[0].aggregatorKind, AggregatorKind.SUM);
      assert.strictEqual(checkPointSet[0].records.length, 2);
    });

    it('should recognize identical labels with different key-insertion order', async () => {
      const batcher = new PrometheusLabelsBatcher();
      const counter = meter.createCounter('test_counter') as CounterMetric;

      const label1: Labels = {};
      label1.key1 = '1';
      label1.key2 = '2';

      const label2: Labels = {};
      label2.key2 = '2';
      label2.key1 = '1';

      counter.bind(label1).add(1);
      counter.bind(label2).add(1);

      const records = await counter.getMetricRecord();
      records.forEach(it => batcher.process(it));

      const checkPointSet = batcher.checkPointSet();
      assert.strictEqual(checkPointSet.length, 1);
      const checkPoint = checkPointSet[0];
      assert.strictEqual(checkPoint.descriptor.name, 'test_counter');
      assert.strictEqual(checkPoint.aggregatorKind, AggregatorKind.SUM);
      assert.strictEqual(checkPoint.records.length, 1);
      const record = checkPoint.records[0];
      assert.strictEqual(record.aggregator.toPoint().value, 2);
    });
  });
});
