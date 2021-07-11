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
import * as assert from 'assert';
import { Meter, MeterProvider } from '../src';

describe('Processor', () => {
  describe('Ungrouped', () => {
    let meter: Meter;
    let fooCounter: api.BoundCounter;
    let barCounter: api.BoundCounter;
    let counter: api.Counter;
    beforeEach(() => {
      meter = new MeterProvider({
        interval: 10000,
      }).getMeter('test-meter');
      counter = meter.createCounter('ungrouped-processor-test');
      fooCounter = counter.bind({ key: 'foo' });
      barCounter = counter.bind({ key: 'bar' });
    });

    it('should process a batch', async () => {
      fooCounter.add(1);
      barCounter.add(1);
      barCounter.add(2);
      await meter.collect();
      const checkPointSet = meter.getProcessor().checkPointSet();
      assert.strictEqual(checkPointSet.length, 2);
      for (const record of checkPointSet) {
        switch (record.labels.key) {
          case 'foo':
            assert.strictEqual(record.aggregator.toPoint().value, 1);
            break;
          case 'bar':
            assert.strictEqual(record.aggregator.toPoint().value, 3);
            break;
          default:
            throw new Error('Unknown labelset');
        }
      }
    });
  });
});
