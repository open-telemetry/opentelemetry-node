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
import * as sinon from 'sinon';
import { ConsoleMetricExporter, MeterProvider, MetricKind } from '../../src';
import { ValueType } from '@opentelemetry/api-metrics';

/* eslint-disable no-console */
describe('ConsoleMetricExporter', () => {
  let consoleExporter: ConsoleMetricExporter;
  let previousConsoleLog: any;

  beforeEach(() => {
    previousConsoleLog = console.log;
    console.log = () => {};
    consoleExporter = new ConsoleMetricExporter();
  });

  afterEach(() => {
    console.log = previousConsoleLog;
  });

  describe('.export()', () => {
    it('should export information about metrics', async () => {
      const spyConsole = sinon.spy(console, 'log');

      const meter = new MeterProvider().getMeter(
        'test-console-metric-exporter'
      );
      const counter = meter.createCounter('counter', {
        description: 'a test description',
      });
      const boundCounter = counter.bind({
        key1: 'labelValue1',
        key2: 'labelValue2',
      });
      boundCounter.add(10);

      await meter.collect();
      consoleExporter.export(meter.getProcessor().checkPointSet(), () => {});
      assert.strictEqual(spyConsole.args.length, 3);
      const [descriptor, labels, value] = spyConsole.args;
      assert.deepStrictEqual(descriptor, [
        {
          description: 'a test description',
          metricKind: MetricKind.COUNTER,
          name: 'counter',
          unit: '1',
          valueType: ValueType.DOUBLE,
        },
      ]);
      assert.deepStrictEqual(labels, [
        {
          key1: 'labelValue1',
          key2: 'labelValue2',
        },
      ]);
      assert.deepStrictEqual(value[0], 'value: 10');
    });
  });
});
