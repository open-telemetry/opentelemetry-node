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

import * as protoLoader from '@grpc/proto-loader';
import {
  Counter,
  ValueObserver,
  ValueRecorder,
} from '@opentelemetry/api-metrics';
import { diag } from '@opentelemetry/api';
import { collectorTypes } from '@opentelemetry/exporter-collector';
import * as metrics from '@opentelemetry/metrics';
import * as assert from 'assert';
import * as fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as path from 'path';
import * as sinon from 'sinon';
import { CollectorMetricExporter } from '../src';
import {
  ensureExportedCounterIsCorrect,
  ensureExportedObserverIsCorrect,
  ensureExportedValueRecorderIsCorrect,
  ensureMetadataIsCorrect,
  ensureResourceIsCorrect,
  mockCounter,
  mockObserver,
  mockValueRecorder,
} from './helper';

const metricsServiceProtoPath =
  'opentelemetry/proto/collector/metrics/v1/metrics_service.proto';
const includeDirs = [path.resolve(__dirname, '../protos')];

const address = 'localhost:1501';

type TestParams = {
  useTLS?: boolean;
  metadata?: grpc.Metadata;
};

const metadata = new grpc.Metadata();
metadata.set('k', 'v');

const testCollectorMetricExporter = (params: TestParams) =>
  describe(`CollectorMetricExporter - node ${
    params.useTLS ? 'with' : 'without'
  } TLS, ${params.metadata ? 'with' : 'without'} metadata`, () => {
    let collectorExporter: CollectorMetricExporter;
    let server: grpc.Server;
    let exportedData:
      | collectorTypes.opentelemetryProto.metrics.v1.ResourceMetrics[]
      | undefined;
    let metrics: metrics.MetricRecord[];
    let reqMetadata: grpc.Metadata | undefined;

    before(done => {
      server = new grpc.Server();
      protoLoader
        .load(metricsServiceProtoPath, {
          keepCase: false,
          longs: String,
          enums: String,
          defaults: true,
          oneofs: true,
          includeDirs,
        })
        .then((packageDefinition: protoLoader.PackageDefinition) => {
          const packageObject: any = grpc.loadPackageDefinition(
            packageDefinition
          );
          server.addService(
            packageObject.opentelemetry.proto.collector.metrics.v1
              .MetricsService.service,
            {
              Export: (data: {
                request: collectorTypes.opentelemetryProto.collector.metrics.v1.ExportMetricsServiceRequest;
                metadata: grpc.Metadata;
              }) => {
                try {
                  exportedData = data.request.resourceMetrics;
                  reqMetadata = data.metadata;
                } catch (e) {
                  exportedData = undefined;
                }
              },
            }
          );
          const credentials = params.useTLS
            ? grpc.ServerCredentials.createSsl(
                fs.readFileSync('./test/certs/ca.crt'),
                [
                  {
                    cert_chain: fs.readFileSync('./test/certs/server.crt'),
                    private_key: fs.readFileSync('./test/certs/server.key'),
                  },
                ]
              )
            : grpc.ServerCredentials.createInsecure();
          server.bindAsync(address, credentials, () => {
            server.start();
            done();
          });
        });
    });

    after(() => {
      server.forceShutdown();
    });

    beforeEach(async () => {
      const credentials = params.useTLS
        ? grpc.credentials.createSsl(
            fs.readFileSync('./test/certs/ca.crt'),
            fs.readFileSync('./test/certs/client.key'),
            fs.readFileSync('./test/certs/client.crt')
          )
        : undefined;
      collectorExporter = new CollectorMetricExporter({
        url: 'grpcs://' + address,
        credentials,
        serviceName: 'basic-service',
        metadata: params.metadata,
      });
      // Overwrites the start time to make tests consistent
      Object.defineProperty(collectorExporter, '_startTime', {
        value: 1592602232694000000,
      });
      metrics = [];
      const counter: metrics.Metric<metrics.BoundCounter> &
        Counter = mockCounter();
      const observer: metrics.Metric<metrics.BoundObserver> &
        ValueObserver = mockObserver(observerResult => {
        observerResult.observe(3, {});
        observerResult.observe(6, {});
      });
      const recorder: metrics.Metric<metrics.BoundValueRecorder> &
        ValueRecorder = mockValueRecorder();

      counter.add(1);
      recorder.record(7);
      recorder.record(14);

      metrics.push((await counter.getMetricRecord())[0]);
      metrics.push((await observer.getMetricRecord())[0]);
      metrics.push((await recorder.getMetricRecord())[0]);
    });

    afterEach(() => {
      exportedData = undefined;
      reqMetadata = undefined;
      sinon.restore();
    });

    describe('instance', () => {
      it('should warn about headers', () => {
        // Need to stub/spy on the underlying logger as the 'diag' instance is global
        const spyLoggerWarn = sinon.stub(diag, 'warn');
        collectorExporter = new CollectorMetricExporter({
          serviceName: 'basic-service',
          url: address,
          headers: {
            foo: 'bar',
          },
        });
        const args = spyLoggerWarn.args[0];
        assert.strictEqual(args[0], 'Headers cannot be set when using grpc');
      });
      it('should warn about path in url', () => {
        const spyLoggerWarn = sinon.stub(diag, 'warn');
        collectorExporter = new CollectorMetricExporter({
          serviceName: 'basic-service',
          url: address + '/v1/metrics',
        });
        const args = spyLoggerWarn.args[0];
        assert.strictEqual(
          args[0],
          'URL path should not be set when using grpc, the path part of the URL will be ignored.'
        );
      });
    });

    describe('export', () => {
      it('should export metrics', done => {
        const responseSpy = sinon.spy();
        collectorExporter.export(metrics, responseSpy);
        setTimeout(() => {
          assert.ok(
            typeof exportedData !== 'undefined',
            'resource' + " doesn't exist"
          );
          let resource;
          if (exportedData) {
            resource = exportedData[0].resource;
            const counter =
              exportedData[0].instrumentationLibraryMetrics[0].metrics[0];
            const observer =
              exportedData[0].instrumentationLibraryMetrics[0].metrics[1];
            const recorder =
              exportedData[0].instrumentationLibraryMetrics[0].metrics[2];
            ensureExportedCounterIsCorrect(
              counter,
              counter.intSum?.dataPoints[0].timeUnixNano
            );
            ensureExportedObserverIsCorrect(
              observer,
              observer.doubleGauge?.dataPoints[0].timeUnixNano
            );
            ensureExportedValueRecorderIsCorrect(
              recorder,
              recorder.intHistogram?.dataPoints[0].timeUnixNano,
              [0, 100],
              ['0', '2', '0']
            );
            assert.ok(
              typeof resource !== 'undefined',
              "resource doesn't exist"
            );
            if (resource) {
              ensureResourceIsCorrect(resource);
            }
          }
          if (params.metadata && reqMetadata) {
            ensureMetadataIsCorrect(reqMetadata, params.metadata);
          }
          done();
        }, 500);
      });
    });
  });

describe('CollectorMetricExporter - node (getDefaultUrl)', () => {
  it('should default to localhost', done => {
    const collectorExporter = new CollectorMetricExporter({});
    setTimeout(() => {
      assert.strictEqual(collectorExporter['url'], 'localhost:4317');
      done();
    });
  });
  it('should keep the URL if included', done => {
    const url = 'http://foo.bar.com';
    const collectorExporter = new CollectorMetricExporter({ url });
    setTimeout(() => {
      assert.strictEqual(collectorExporter['url'], url);
      done();
    });
  });
});

describe('when configuring via environment', () => {
  const envSource = process.env;
  it('should use url defined in env', () => {
    envSource.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://foo.bar';
    const collectorExporter = new CollectorMetricExporter();
    assert.strictEqual(
      collectorExporter.url,
      envSource.OTEL_EXPORTER_OTLP_ENDPOINT
    );
    envSource.OTEL_EXPORTER_OTLP_ENDPOINT = '';
  });
  it('should override global exporter url with signal url defined in env', () => {
    envSource.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://foo.bar';
    envSource.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = 'http://foo.metrics';
    const collectorExporter = new CollectorMetricExporter();
    assert.strictEqual(
      collectorExporter.url,
      envSource.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
    );
    envSource.OTEL_EXPORTER_OTLP_ENDPOINT = '';
    envSource.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = '';
  });
});

testCollectorMetricExporter({ useTLS: true });
testCollectorMetricExporter({ useTLS: false });
testCollectorMetricExporter({ metadata });
