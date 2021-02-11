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

import { createNoopDiagLogger } from '@opentelemetry/api';
import {
  Counter,
  ValueObserver,
  ValueRecorder,
} from '@opentelemetry/api-metrics';
import { ExportResultCode, hrTimeToNanoseconds } from '@opentelemetry/core';
import {
  BoundCounter,
  BoundObserver,
  BoundValueRecorder,
  Metric,
  MetricRecord,
} from '@opentelemetry/metrics';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { CollectorMetricExporter } from '../../src/platform/browser/index';
import * as collectorTypes from '../../src/types';
import { CollectorExporterConfigBase } from '../../src/types';
import {
  ensureCounterIsCorrect,
  ensureExportMetricsServiceRequestIsSet,
  ensureHeadersContain,
  ensureObserverIsCorrect,
  ensureValueRecorderIsCorrect,
  ensureWebResourceIsCorrect,
  mockCounter,
  mockObserver,
  mockValueRecorder,
} from '../helper';

const sendBeacon = navigator.sendBeacon;

describe('CollectorMetricExporter - web', () => {
  let collectorExporter: CollectorMetricExporter;
  let spyOpen: any;
  let spySend: any;
  let spyBeacon: any;
  let metrics: MetricRecord[];

  beforeEach(async () => {
    spyOpen = sinon.stub(XMLHttpRequest.prototype, 'open');
    spySend = sinon.stub(XMLHttpRequest.prototype, 'send');
    spyBeacon = sinon.stub(navigator, 'sendBeacon');
    metrics = [];
    const counter: Metric<BoundCounter> & Counter = mockCounter();
    const observer: Metric<BoundObserver> & ValueObserver = mockObserver(
      observerResult => {
        observerResult.observe(3, {});
        observerResult.observe(6, {});
      },
      'double-observer2'
    );
    const recorder: Metric<BoundValueRecorder> &
      ValueRecorder = mockValueRecorder();
    counter.add(1);
    recorder.record(7);
    recorder.record(14);

    metrics.push((await counter.getMetricRecord())[0]);
    metrics.push((await observer.getMetricRecord())[0]);
    metrics.push((await recorder.getMetricRecord())[0]);
  });

  afterEach(() => {
    navigator.sendBeacon = sendBeacon;
    spyOpen.restore();
    spySend.restore();
    spyBeacon.restore();
  });

  describe('export', () => {
    describe('when "sendBeacon" is available', () => {
      beforeEach(() => {
        collectorExporter = new CollectorMetricExporter({
          diagLogger: createNoopDiagLogger(),
          url: 'http://foo.bar.com',
          serviceName: 'bar',
        });
        // Overwrites the start time to make tests consistent
        Object.defineProperty(collectorExporter, '_startTime', {
          value: 1592602232694000000,
        });
      });
      it('should successfully send metrics using sendBeacon', done => {
        collectorExporter.export(metrics, () => {});

        setTimeout(() => {
          const args = spyBeacon.args[0];
          const url = args[0];
          const body = args[1];
          const json = JSON.parse(
            body
          ) as collectorTypes.opentelemetryProto.collector.metrics.v1.ExportMetricsServiceRequest;
          const metric1 =
            json.resourceMetrics[0].instrumentationLibraryMetrics[0].metrics[0];
          const metric2 =
            json.resourceMetrics[0].instrumentationLibraryMetrics[0].metrics[1];
          const metric3 =
            json.resourceMetrics[0].instrumentationLibraryMetrics[0].metrics[2];

          assert.ok(typeof metric1 !== 'undefined', "metric doesn't exist");
          if (metric1) {
            ensureCounterIsCorrect(
              metric1,
              hrTimeToNanoseconds(metrics[0].aggregator.toPoint().timestamp)
            );
          }

          assert.ok(
            typeof metric2 !== 'undefined',
            "second metric doesn't exist"
          );
          if (metric2) {
            ensureObserverIsCorrect(
              metric2,
              hrTimeToNanoseconds(metrics[1].aggregator.toPoint().timestamp),
              6,
              'double-observer2'
            );
          }

          assert.ok(
            typeof metric3 !== 'undefined',
            "third metric doesn't exist"
          );
          if (metric3) {
            ensureValueRecorderIsCorrect(
              metric3,
              hrTimeToNanoseconds(metrics[2].aggregator.toPoint().timestamp),
              [0, 100],
              [0, 2, 0]
            );
          }

          const resource = json.resourceMetrics[0].resource;
          assert.ok(typeof resource !== 'undefined', "resource doesn't exist");
          if (resource) {
            ensureWebResourceIsCorrect(resource);
          }

          assert.strictEqual(url, 'http://foo.bar.com');
          assert.strictEqual(spyBeacon.callCount, 1);

          assert.strictEqual(spyOpen.callCount, 0);

          ensureExportMetricsServiceRequestIsSet(json);

          done();
        });
      });

      it('should log the successful message', done => {
        const spyLoggerDebug = sinon.stub(
          collectorExporter.diagLogger,
          'debug'
        );
        const spyLoggerError = sinon.stub(
          collectorExporter.diagLogger,
          'error'
        );
        spyBeacon.restore();
        spyBeacon = sinon.stub(window.navigator, 'sendBeacon').returns(true);

        collectorExporter.export(metrics, () => {});

        setTimeout(() => {
          const response: any = spyLoggerDebug.args[1][0];
          assert.strictEqual(response, 'sendBeacon - can send');
          assert.strictEqual(spyLoggerError.args.length, 0);

          done();
        });
      });

      it('should log the error message', done => {
        spyBeacon.restore();
        spyBeacon = sinon.stub(window.navigator, 'sendBeacon').returns(false);

        collectorExporter.export(metrics, result => {
          assert.deepStrictEqual(result.code, ExportResultCode.FAILED);
          assert.ok(result.error?.message.includes('cannot send'));
          done();
        });
      });
    });

    describe('when "sendBeacon" is NOT available', () => {
      let server: any;
      beforeEach(() => {
        (window.navigator as any).sendBeacon = false;
        collectorExporter = new CollectorMetricExporter({
          diagLogger: createNoopDiagLogger(),
          url: 'http://foo.bar.com',
          serviceName: 'bar',
        });
        // Overwrites the start time to make tests consistent
        Object.defineProperty(collectorExporter, '_startTime', {
          value: 1592602232694000000,
        });
        server = sinon.fakeServer.create();
      });
      afterEach(() => {
        server.restore();
      });

      it('should successfully send the metrics using XMLHttpRequest', done => {
        collectorExporter.export(metrics, () => {});

        setTimeout(() => {
          const request = server.requests[0];
          assert.strictEqual(request.method, 'POST');
          assert.strictEqual(request.url, 'http://foo.bar.com');

          const body = request.requestBody;
          const json = JSON.parse(
            body
          ) as collectorTypes.opentelemetryProto.collector.metrics.v1.ExportMetricsServiceRequest;
          const metric1 =
            json.resourceMetrics[0].instrumentationLibraryMetrics[0].metrics[0];
          const metric2 =
            json.resourceMetrics[0].instrumentationLibraryMetrics[0].metrics[1];
          const metric3 =
            json.resourceMetrics[0].instrumentationLibraryMetrics[0].metrics[2];
          assert.ok(typeof metric1 !== 'undefined', "metric doesn't exist");
          if (metric1) {
            ensureCounterIsCorrect(
              metric1,
              hrTimeToNanoseconds(metrics[0].aggregator.toPoint().timestamp)
            );
          }
          assert.ok(
            typeof metric2 !== 'undefined',
            "second metric doesn't exist"
          );
          if (metric2) {
            ensureObserverIsCorrect(
              metric2,
              hrTimeToNanoseconds(metrics[1].aggregator.toPoint().timestamp),
              6,
              'double-observer2'
            );
          }

          assert.ok(
            typeof metric3 !== 'undefined',
            "third metric doesn't exist"
          );
          if (metric3) {
            ensureValueRecorderIsCorrect(
              metric3,
              hrTimeToNanoseconds(metrics[2].aggregator.toPoint().timestamp),
              [0, 100],
              [0, 2, 0]
            );
          }

          const resource = json.resourceMetrics[0].resource;
          assert.ok(typeof resource !== 'undefined', "resource doesn't exist");
          if (resource) {
            ensureWebResourceIsCorrect(resource);
          }

          assert.strictEqual(spyBeacon.callCount, 0);
          ensureExportMetricsServiceRequestIsSet(json);

          done();
        });
      });

      it('should log the successful message', done => {
        const spyLoggerDebug = sinon.stub(
          collectorExporter.diagLogger,
          'debug'
        );
        const spyLoggerError = sinon.stub(
          collectorExporter.diagLogger,
          'error'
        );

        collectorExporter.export(metrics, () => {});

        setTimeout(() => {
          const request = server.requests[0];
          request.respond(200);

          const response: any = spyLoggerDebug.args[1][0];
          assert.strictEqual(response, 'xhr success');
          assert.strictEqual(spyLoggerError.args.length, 0);

          assert.strictEqual(spyBeacon.callCount, 0);
          done();
        });
      });

      it('should log the error message', done => {
        collectorExporter.export(metrics, result => {
          assert.deepStrictEqual(result.code, ExportResultCode.FAILED);
          assert.ok(result.error?.message.includes('Failed to export'));
          assert.strictEqual(spyBeacon.callCount, 0);
          done();
        });

        setTimeout(() => {
          const request = server.requests[0];
          request.respond(400);
        });
      });
      it('should send custom headers', done => {
        collectorExporter.export(metrics, () => {});

        setTimeout(() => {
          const request = server.requests[0];
          request.respond(200);

          assert.strictEqual(spyBeacon.callCount, 0);
          done();
        });
      });
    });
  });

  describe('export with custom headers', () => {
    let server: any;
    const customHeaders = {
      foo: 'bar',
      bar: 'baz',
    };
    let collectorExporterConfig: CollectorExporterConfigBase;

    beforeEach(() => {
      collectorExporterConfig = {
        diagLogger: createNoopDiagLogger(),
        headers: customHeaders,
      };
      server = sinon.fakeServer.create();
    });

    afterEach(() => {
      server.restore();
    });

    describe('when "sendBeacon" is available', () => {
      beforeEach(() => {
        collectorExporter = new CollectorMetricExporter(
          collectorExporterConfig
        );
      });
      it('should successfully send custom headers using XMLHTTPRequest', done => {
        collectorExporter.export(metrics, () => {});

        setTimeout(() => {
          const [{ requestHeaders }] = server.requests;

          ensureHeadersContain(requestHeaders, customHeaders);
          assert.strictEqual(spyBeacon.callCount, 0);
          assert.strictEqual(spyOpen.callCount, 0);

          done();
        });
      });
    });

    describe('when "sendBeacon" is NOT available', () => {
      beforeEach(() => {
        (window.navigator as any).sendBeacon = false;
        collectorExporter = new CollectorMetricExporter(
          collectorExporterConfig
        );
      });

      it('should successfully send metrics using XMLHttpRequest', done => {
        collectorExporter.export(metrics, () => {});

        setTimeout(() => {
          const [{ requestHeaders }] = server.requests;

          ensureHeadersContain(requestHeaders, customHeaders);
          assert.strictEqual(spyBeacon.callCount, 0);
          assert.strictEqual(spyOpen.callCount, 0);

          done();
        });
      });
    });
  });
});
