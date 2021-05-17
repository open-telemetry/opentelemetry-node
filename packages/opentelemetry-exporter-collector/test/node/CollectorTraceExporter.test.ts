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

import { diag } from '@opentelemetry/api';
import * as core from '@opentelemetry/core';
import { ReadableSpan } from '@opentelemetry/tracing';
import * as http from 'http';
import * as assert from 'assert';
import * as sinon from 'sinon';
import {
  CollectorTraceExporter,
  CollectorExporterNodeConfigBase,
} from '../../src/platform/node';
import * as collectorTypes from '../../src/types';
import { MockedResponse } from './nodeHelpers';

import {
  ensureExportTraceServiceRequestIsSet,
  ensureSpanIsCorrect,
  mockedReadableSpan,
} from '../helper';

const fakeRequest = {
  end: function () {},
  on: function () {},
  write: function () {},
};

const address = 'localhost:1501';

describe('CollectorTraceExporter - node with json over http', () => {
  let collectorExporter: CollectorTraceExporter;
  let collectorExporterConfig: CollectorExporterNodeConfigBase;
  let stubRequest: sinon.SinonStub;
  let stubWrite: sinon.SinonStub;
  let spans: ReadableSpan[];

  afterEach(() => {
    sinon.restore();
  });

  describe('instance', () => {
    it('should warn about metadata when using json', () => {
      const metadata = 'foo';
      // Need to stub/spy on the underlying logger as the "diag" instance is global
      const spyLoggerWarn = sinon.stub(diag, 'warn');
      collectorExporter = new CollectorTraceExporter({
        serviceName: 'basic-service',
        metadata,
        url: address,
      } as any);
      const args = spyLoggerWarn.args[0];
      assert.strictEqual(args[0], 'Metadata cannot be set when using http');
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
    it('should use headers defined via env', () => {
      envSource.OTEL_EXPORTER_OTLP_HEADERS = 'foo=bar';
      const collectorExporter = new CollectorTraceExporter();
      assert.strictEqual(collectorExporter.headers.foo, 'bar');
      envSource.OTEL_EXPORTER_OTLP_HEADERS = '';
    });
    it('should override global headers config with signal headers defined via env', () => {
      envSource.OTEL_EXPORTER_OTLP_HEADERS = 'foo=bar,bar=foo';
      envSource.OTEL_EXPORTER_OTLP_TRACES_HEADERS = 'foo=boo';
      const collectorExporter = new CollectorTraceExporter();
      assert.strictEqual(collectorExporter.headers.foo, 'boo');
      assert.strictEqual(collectorExporter.headers.bar, 'foo');
      envSource.OTEL_EXPORTER_OTLP_TRACES_HEADERS = '';
      envSource.OTEL_EXPORTER_OTLP_HEADERS = '';
    });
  });

  describe('export', () => {
    beforeEach(() => {
      stubRequest = sinon.stub(http, 'request').returns(fakeRequest as any);
      stubWrite = sinon.stub(fakeRequest, 'write');
      collectorExporterConfig = {
        headers: {
          foo: 'bar',
        },
        hostname: 'foo',
        serviceName: 'bar',
        attributes: {},
        url: 'http://foo.bar.com',
        keepAlive: true,
        httpAgentOptions: { keepAliveMsecs: 2000 },
      };
      collectorExporter = new CollectorTraceExporter(collectorExporterConfig);
      spans = [];
      spans.push(Object.assign({}, mockedReadableSpan));
    });

    it('should open the connection', done => {
      collectorExporter.export(spans, () => {});

      setTimeout(() => {
        const args = stubRequest.args[0];
        const options = args[0];

        assert.strictEqual(options.hostname, 'foo.bar.com');
        assert.strictEqual(options.method, 'POST');
        assert.strictEqual(options.path, '/');
        done();
      });
    });

    it('should set custom headers', done => {
      collectorExporter.export(spans, () => {});

      setTimeout(() => {
        const args = stubRequest.args[0];
        const options = args[0];
        assert.strictEqual(options.headers['foo'], 'bar');
        done();
      });
    });

    it('should have keep alive and keepAliveMsecs option set', done => {
      collectorExporter.export(spans, () => {});

      setTimeout(() => {
        const args = stubRequest.args[0];
        const options = args[0];
        const agent = options.agent;
        assert.strictEqual(agent.keepAlive, true);
        assert.strictEqual(agent.options.keepAliveMsecs, 2000);
        done();
      });
    });

    it('different http export requests should use the same agent', done => {
      collectorExporter.export(spans, () => {});
      collectorExporter.export(spans, () => {});

      setTimeout(() => {
        const [firstExportAgent, secondExportAgent] = stubRequest.args.map(
          a => a[0].agent
        );
        assert.strictEqual(firstExportAgent, secondExportAgent);
        done();
      });
    });

    it('should successfully send the spans', done => {
      collectorExporter.export(spans, () => {});

      setTimeout(() => {
        const writeArgs = stubWrite.args[0];
        const json = JSON.parse(
          writeArgs[0]
        ) as collectorTypes.opentelemetryProto.collector.trace.v1.ExportTraceServiceRequest;
        const span1 =
          json.resourceSpans[0].instrumentationLibrarySpans[0].spans[0];
        assert.ok(typeof span1 !== 'undefined', "span doesn't exist");
        if (span1) {
          ensureSpanIsCorrect(span1);
        }

        ensureExportTraceServiceRequestIsSet(json);

        done();
      });
    });

    it('should log the successful message', done => {
      // Need to stub/spy on the underlying logger as the "diag" instance is global
      const stubLoggerError = sinon.stub(diag, 'error');
      const responseSpy = sinon.spy();
      collectorExporter.export(spans, responseSpy);

      setTimeout(() => {
        const mockRes = new MockedResponse(200);
        const args = stubRequest.args[0];
        const callback = args[1];
        callback(mockRes);
        mockRes.send('success');
        setTimeout(() => {
          assert.strictEqual(stubLoggerError.args.length, 0);
          assert.strictEqual(
            responseSpy.args[0][0].code,
            core.ExportResultCode.SUCCESS
          );
          done();
        });
      });
    });

    it('should log the error message', done => {
      const responseSpy = sinon.spy();
      collectorExporter.export(spans, responseSpy);

      setTimeout(() => {
        const mockResError = new MockedResponse(400);
        const args = stubRequest.args[0];
        const callback = args[1];
        callback(mockResError);
        mockResError.send('failed');
        setTimeout(() => {
          const result = responseSpy.args[0][0] as core.ExportResult;
          assert.strictEqual(result.code, core.ExportResultCode.FAILED);
          const error = result.error as collectorTypes.CollectorExporterError;
          assert.ok(error !== undefined);
          assert.strictEqual(error.code, 400);
          assert.strictEqual(error.data, 'failed');
          done();
        });
      });
    });
  });
  describe('CollectorTraceExporter - node (getDefaultUrl)', () => {
    it('should default to localhost', done => {
      const collectorExporter = new CollectorTraceExporter();
      setTimeout(() => {
        assert.strictEqual(
          collectorExporter['url'],
          'http://localhost:55681/v1/traces'
        );
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
});
