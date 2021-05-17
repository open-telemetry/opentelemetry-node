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
  Counter,
  SumObserver,
  UpDownSumObserver,
  ValueObserver,
  ValueRecorder,
} from '@opentelemetry/api-metrics';
import { hrTimeToNanoseconds } from '@opentelemetry/core';
import {
  BoundCounter,
  BoundObserver,
  BoundValueRecorder,
  Metric,
  SumAggregator,
} from '@opentelemetry/metrics';
import { Resource } from '@opentelemetry/resources';
import * as assert from 'assert';
import * as transform from '../../src/transformMetrics';
import {
  ensureCounterIsCorrect,
  ensureDoubleCounterIsCorrect,
  ensureObserverIsCorrect,
  ensureSumObserverIsCorrect,
  ensureUpDownSumObserverIsCorrect,
  ensureValueRecorderIsCorrect,
  mockCounter,
  mockDoubleCounter,
  mockedInstrumentationLibraries,
  mockedResources,
  mockObserver,
  mockSumObserver,
  mockUpDownSumObserver,
  mockValueRecorder,
  multiInstrumentationLibraryMetricsGet,
  multiResourceMetricsGet,
} from '../helper';

describe('transformMetrics', () => {
  describe('toCollectorMetric', async () => {
    let counter: Metric<BoundCounter> & Counter;
    let doubleCounter: Metric<BoundCounter> & Counter;
    let observer: Metric<BoundObserver> & ValueObserver;
    let sumObserver: Metric<BoundObserver> & SumObserver;
    let upDownSumObserver: Metric<BoundObserver> & UpDownSumObserver;
    let recorder: Metric<BoundValueRecorder> & ValueRecorder;
    beforeEach(() => {
      counter = mockCounter();
      doubleCounter = mockDoubleCounter();
      let count1 = 0;
      let count2 = 0;
      let count3 = 0;

      function getValue(count: number) {
        if (count % 2 === 0) {
          return 3;
        }
        return -1;
      }

      observer = mockObserver(observerResult => {
        count1++;
        observerResult.observe(getValue(count1), {});
      });

      sumObserver = mockSumObserver(observerResult => {
        count2++;
        observerResult.observe(getValue(count2), {});
      });

      upDownSumObserver = mockUpDownSumObserver(observerResult => {
        count3++;
        observerResult.observe(getValue(count3), {});
      });

      recorder = mockValueRecorder();

      // Counter
      counter.add(1);

      // Double Counter
      doubleCounter.add(8);

      // ValueRecorder
      recorder.record(7);
      recorder.record(14);
    });

    it('should convert metric', async () => {
      const counterMetric = (await counter.getMetricRecord())[0];
      ensureCounterIsCorrect(
        transform.toCollectorMetric(counterMetric, 1592602232694000000),
        hrTimeToNanoseconds(await counterMetric.aggregator.toPoint().timestamp)
      );

      const doubleCounterMetric = (await doubleCounter.getMetricRecord())[0];
      ensureDoubleCounterIsCorrect(
        transform.toCollectorMetric(doubleCounterMetric, 1592602232694000000),
        hrTimeToNanoseconds(doubleCounterMetric.aggregator.toPoint().timestamp)
      );

      await observer.getMetricRecord();
      await observer.getMetricRecord();
      const observerMetric = (await observer.getMetricRecord())[0];
      ensureObserverIsCorrect(
        transform.toCollectorMetric(observerMetric, 1592602232694000000),
        hrTimeToNanoseconds(observerMetric.aggregator.toPoint().timestamp),
        -1
      );

      // collect 3 times
      await sumObserver.getMetricRecord();
      await sumObserver.getMetricRecord();
      const sumObserverMetric = (await sumObserver.getMetricRecord())[0];
      ensureSumObserverIsCorrect(
        transform.toCollectorMetric(sumObserverMetric, 1592602232694000000),
        hrTimeToNanoseconds(sumObserverMetric.aggregator.toPoint().timestamp),
        3
      );

      // collect 3 times
      await upDownSumObserver.getMetricRecord();
      await upDownSumObserver.getMetricRecord();
      const upDownSumObserverMetric = (
        await upDownSumObserver.getMetricRecord()
      )[0];
      ensureUpDownSumObserverIsCorrect(
        transform.toCollectorMetric(
          upDownSumObserverMetric,
          1592602232694000000
        ),
        hrTimeToNanoseconds(
          upDownSumObserverMetric.aggregator.toPoint().timestamp
        ),
        -1
      );

      const recorderMetric = (await recorder.getMetricRecord())[0];
      ensureValueRecorderIsCorrect(
        transform.toCollectorMetric(recorderMetric, 1592602232694000000),
        hrTimeToNanoseconds(recorderMetric.aggregator.toPoint().timestamp),
        [0, 100],
        [0, 2, 0]
      );
    });

    it('should convert metric labels value to string', () => {
      const metric = transform.toCollectorMetric(
        {
          descriptor: {
            name: 'name',
            description: 'description',
            unit: 'unit',
            metricKind: 0,
            valueType: 0,
          },
          labels: { foo: (1 as unknown) as string },
          aggregator: new SumAggregator(),
          resource: new Resource({}),
          aggregationTemporality: 0,
          instrumentationLibrary: { name: 'x', version: 'y' },
        },
        1592602232694000000
      );
      const collectorMetric = metric.intSum?.dataPoints[0];
      assert.strictEqual(collectorMetric?.labels[0].value, '1');
    });
  });

  describe('groupMetricsByResourceAndLibrary', () => {
    it('should group by resource', async () => {
      const [resource1, resource2] = mockedResources;
      const [library] = mockedInstrumentationLibraries;
      const [metric1, metric2, metric3] = multiResourceMetricsGet(
        observerResult => {
          observerResult.observe(1, {});
        }
      );

      const expected = new Map([
        [resource1, new Map([[library, [metric1, metric3]]])],
        [resource2, new Map([[library, [metric2]]])],
      ]);

      const result = transform.groupMetricsByResourceAndLibrary(
        multiResourceMetricsGet(observerResult => {
          observerResult.observe(1, {});
        })
      );

      assert.deepStrictEqual(result, expected);
    });

    it('should group by instrumentation library', async () => {
      const [resource] = mockedResources;
      const [lib1, lib2] = mockedInstrumentationLibraries;
      const [
        metric1,
        metric2,
        metric3,
      ] = multiInstrumentationLibraryMetricsGet(observerResult => {});
      const expected = new Map([
        [
          resource,
          new Map([
            [lib1, [metric1, metric3]],
            [lib2, [metric2]],
          ]),
        ],
      ]);

      const result = transform.groupMetricsByResourceAndLibrary(
        multiInstrumentationLibraryMetricsGet(observerResult => {})
      );

      assert.deepStrictEqual(result, expected);
    });
  });
});
