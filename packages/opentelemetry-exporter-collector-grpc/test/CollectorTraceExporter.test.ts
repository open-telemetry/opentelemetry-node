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
import { collectorTypes } from '@opentelemetry/exporter-collector';
import { diag } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/tracing';

import * as assert from 'assert';
import * as fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as path from 'path';
import * as sinon from 'sinon';
import { CollectorTraceExporter } from '../src';

import {
  ensureExportedSpanIsCorrect,
  ensureMetadataIsCorrect,
  ensureResourceIsCorrect,
  mockedReadableSpan,
} from './helper';

const traceServiceProtoPath =
  'opentelemetry/proto/collector/trace/v1/trace_service.proto';
const includeDirs = [path.resolve(__dirname, '../protos')];

const address = 'localhost:1501';

type TestParams = {
  useTLS?: boolean;
  metadata?: grpc.Metadata;
};

const metadata = new grpc.Metadata();
metadata.set('k', 'v');

const testCollectorExporter = (params: TestParams) =>
  describe(`CollectorTraceExporter - node ${
    params.useTLS ? 'with' : 'without'
  } TLS, ${params.metadata ? 'with' : 'without'} metadata`, () => {
    let collectorExporter: CollectorTraceExporter;
    let server: grpc.Server;
    let exportedData:
      | collectorTypes.opentelemetryProto.trace.v1.ResourceSpans
      | undefined;
    let reqMetadata: grpc.Metadata | undefined;

    before(done => {
      server = new grpc.Server();
      protoLoader
        .load(traceServiceProtoPath, {
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
            packageObject.opentelemetry.proto.collector.trace.v1.TraceService
              .service,
            {
              Export: (data: {
                request: collectorTypes.opentelemetryProto.collector.trace.v1.ExportTraceServiceRequest;
                metadata: grpc.Metadata;
              }) => {
                try {
                  exportedData = data.request.resourceSpans[0];
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

    beforeEach(done => {
      const credentials = params.useTLS
        ? grpc.credentials.createSsl(
            fs.readFileSync('./test/certs/ca.crt'),
            fs.readFileSync('./test/certs/client.key'),
            fs.readFileSync('./test/certs/client.crt')
          )
        : undefined;
      collectorExporter = new CollectorTraceExporter({
        serviceName: 'basic-service',
        url: 'grpcs://' + address,
        credentials,
        metadata: params.metadata,
      });

      const provider = new BasicTracerProvider();
      provider.addSpanProcessor(new SimpleSpanProcessor(collectorExporter));
      done();
    });

    afterEach(() => {
      exportedData = undefined;
      reqMetadata = undefined;
      sinon.restore();
    });

    describe('instance', () => {
      it('should warn about headers when using grpc', () => {
        // Need to stub/spy on the underlying logger as the 'diag' instance is global
        const spyLoggerWarn = sinon.stub(diag, 'warn');
        collectorExporter = new CollectorTraceExporter({
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
        collectorExporter = new CollectorTraceExporter({
          serviceName: 'basic-service',
          url: address + '/v1/trace',
        });
        const args = spyLoggerWarn.args[0];
        assert.strictEqual(
          args[0],
          'URL path should not be set when using grpc, the path part of the URL will be ignored.'
        );
      });
    });

    describe('export', () => {
      it('should export spans', done => {
        const responseSpy = sinon.spy();
        const spans = [Object.assign({}, mockedReadableSpan)];
        collectorExporter.export(spans, responseSpy);
        setTimeout(() => {
          assert.ok(
            typeof exportedData !== 'undefined',
            'resource' + " doesn't exist"
          );
          let spans;
          let resource;
          if (exportedData) {
            spans = exportedData.instrumentationLibrarySpans[0].spans;
            resource = exportedData.resource;
            ensureExportedSpanIsCorrect(spans[0]);

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
        }, 200);
      });
    });
  });

describe('CollectorTraceExporter - node (getDefaultUrl)', () => {
  it('should default to localhost', done => {
    const collectorExporter = new CollectorTraceExporter({});
    setTimeout(() => {
      assert.strictEqual(collectorExporter['url'], 'localhost:4317');
      done();
    });
  });
  it('should keep the URL if included', done => {
    const url = 'http://foo.bar.com';
    const collectorExporter = new CollectorTraceExporter({ url });
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
    const collectorExporter = new CollectorTraceExporter();
    assert.strictEqual(
      collectorExporter.url,
      envSource.OTEL_EXPORTER_OTLP_ENDPOINT
    );
    envSource.OTEL_EXPORTER_OTLP_ENDPOINT = '';
  });
  it('should override global exporter url with signal url defined in env', () => {
    envSource.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://foo.bar';
    envSource.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = 'http://foo.traces';
    const collectorExporter = new CollectorTraceExporter();
    assert.strictEqual(
      collectorExporter.url,
      envSource.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
    );
    envSource.OTEL_EXPORTER_OTLP_ENDPOINT = '';
    envSource.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = '';
  });
});

testCollectorExporter({ useTLS: true });
testCollectorExporter({ useTLS: false });
testCollectorExporter({ metadata });
