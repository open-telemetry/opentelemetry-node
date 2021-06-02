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

import { Counter, ValueObserver } from '@opentelemetry/api-metrics';
import { ExportResultCode } from '@opentelemetry/core';
import {
  BoundCounter,
  BoundObserver,
  Metric,
  MetricRecord,
} from '@opentelemetry/metrics';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { CollectorExporterBase } from '../../src/CollectorExporterBase';
import * as collectorTypes from '../../src/types';
import { CollectorExporterConfigBase } from '../../src/types';
import { mockCounter, mockObserver } from '../helper';

type CollectorExporterConfig = CollectorExporterConfigBase;
class CollectorMetricExporter extends CollectorExporterBase<
  CollectorExporterConfig,
  MetricRecord,
  collectorTypes.opentelemetryProto.collector.metrics.v1.ExportMetricsServiceRequest
> {
  onInit() {}
  onShutdown() {}
  send() {}
  getDefaultUrl(config: CollectorExporterConfig) {
    return config.url || '';
  }
  convert(
    metrics: MetricRecord[]
  ): collectorTypes.opentelemetryProto.collector.metrics.v1.ExportMetricsServiceRequest {
    return { resourceMetrics: [] };
  }
}

describe('CollectorMetricExporter - common', () => {
  let collectorExporter: CollectorMetricExporter;
  let collectorExporterConfig: CollectorExporterConfig;
  let metrics: MetricRecord[];

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    let onInitSpy: any;

    beforeEach(async () => {
      onInitSpy = sinon.stub(CollectorMetricExporter.prototype, 'onInit');
      collectorExporterConfig = {
        hostname: 'foo',
        attributes: {},
        url: 'http://foo.bar.com',
      };
      collectorExporter = new CollectorMetricExporter(collectorExporterConfig);
      metrics = [];
      const counter: Metric<BoundCounter> & Counter = mockCounter();
      const observer: Metric<BoundObserver> & ValueObserver = mockObserver(
        observerResult => {
          observerResult.observe(3, {});
          observerResult.observe(6, {});
        },
        'double-observer3'
      );
      counter.add(1);

      metrics.push((await counter.getMetricRecord())[0]);
      metrics.push((await observer.getMetricRecord())[0]);
    });

    it('should create an instance', () => {
      assert.ok(typeof collectorExporter !== 'undefined');
    });

    it('should call onInit', () => {
      assert.strictEqual(onInitSpy.callCount, 1);
    });

    describe('when config contains certain params', () => {
      it('should set hostname', () => {
        assert.strictEqual(collectorExporter.hostname, 'foo');
      });

      it('should set url', () => {
        assert.strictEqual(collectorExporter.url, 'http://foo.bar.com');
      });
    });

    describe('when config is missing certain params', () => {
      beforeEach(() => {
        collectorExporter = new CollectorMetricExporter();
      });
    });
  });

  describe('export', () => {
    let spySend: any;
    beforeEach(() => {
      spySend = sinon.stub(CollectorMetricExporter.prototype, 'send');
      collectorExporter = new CollectorMetricExporter(collectorExporterConfig);
    });

    it('should export metrics as collectorTypes.Metrics', done => {
      collectorExporter.export(metrics, () => {});
      setTimeout(() => {
        const metric1 = spySend.args[0][0][0] as MetricRecord;
        assert.deepStrictEqual(metrics[0], metric1);
        const metric2 = spySend.args[0][0][1] as MetricRecord;
        assert.deepStrictEqual(metrics[1], metric2);
        done();
      });
      assert.strictEqual(spySend.callCount, 1);
    });

    describe('when exporter is shutdown', () => {
      it(
        'should not export anything but return callback with code' +
          ' "FailedNotRetryable"',
        async () => {
          await collectorExporter.shutdown();
          spySend.resetHistory();

          const callbackSpy = sinon.spy();
          collectorExporter.export(metrics, callbackSpy);
          const returnCode = callbackSpy.args[0][0];
          assert.strictEqual(
            returnCode.code,
            ExportResultCode.FAILED,
            'return value is wrong'
          );
          assert.strictEqual(spySend.callCount, 0, 'should not call send');
        }
      );
    });
    describe('when an error occurs', () => {
      it('should return failed export result', done => {
        spySend.throws({
          code: 600,
          details: 'Test error',
          metadata: {},
          message: 'Non-Retryable',
          stack: 'Stack',
        });
        const callbackSpy = sinon.spy();
        collectorExporter.export(metrics, callbackSpy);
        setTimeout(() => {
          const returnCode = callbackSpy.args[0][0];
          assert.strictEqual(
            returnCode.code,
            ExportResultCode.FAILED,
            'return value is wrong'
          );
          assert.strictEqual(
            returnCode.error.message,
            'Non-Retryable',
            'return error message is wrong'
          );
          assert.strictEqual(spySend.callCount, 1, 'should call send');
          done();
        });
      });
    });
  });

  describe('shutdown', () => {
    let onShutdownSpy: any;
    beforeEach(() => {
      onShutdownSpy = sinon.stub(
        CollectorMetricExporter.prototype,
        'onShutdown'
      );
      collectorExporterConfig = {
        hostname: 'foo',
        attributes: {},
        url: 'http://foo.bar.com',
      };
      collectorExporter = new CollectorMetricExporter(collectorExporterConfig);
    });

    it('should call onShutdown', async () => {
      await collectorExporter.shutdown();
      assert.strictEqual(onShutdownSpy.callCount, 1);
    });
  });
});
