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
import { ExportResultCode } from '@opentelemetry/core';
import { ReadableSpan } from '@opentelemetry/tracing';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { CollectorTraceExporter } from '../../src/platform/browser/index';
import { CollectorExporterConfigBase } from '../../src/types';
import * as collectorTypes from '../../src/types';

import {
  ensureSpanIsCorrect,
  ensureExportTraceServiceRequestIsSet,
  ensureWebResourceIsCorrect,
  ensureHeadersContain,
  mockedReadableSpan,
} from '../helper';

describe('CollectorTraceExporter - web', () => {
  let collectorTraceExporter: CollectorTraceExporter;
  let collectorExporterConfig: CollectorExporterConfigBase;
  let stubOpen: sinon.SinonStub;
  let stubBeacon: sinon.SinonStub;
  let spans: ReadableSpan[];

  beforeEach(() => {
    stubOpen = sinon.stub(XMLHttpRequest.prototype, 'open');
    sinon.stub(XMLHttpRequest.prototype, 'send');
    stubBeacon = sinon.stub(navigator, 'sendBeacon');
    spans = [];
    spans.push(Object.assign({}, mockedReadableSpan));
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('export', () => {
    beforeEach(() => {
      collectorExporterConfig = {
        hostname: 'foo',
        attributes: {},
        url: 'http://foo.bar.com',
      };
    });

    describe('when "sendBeacon" is available', () => {
      beforeEach(() => {
        collectorTraceExporter = new CollectorTraceExporter(
          collectorExporterConfig
        );
      });

      it('should successfully send the spans using sendBeacon', done => {
        collectorTraceExporter.export(spans, () => {});

        setTimeout(() => {
          const args = stubBeacon.args[0];
          const url = args[0];
          const body = args[1];
          const json = JSON.parse(
            body
          ) as collectorTypes.opentelemetryProto.collector.trace.v1.ExportTraceServiceRequest;
          const span1 =
            json.resourceSpans[0].instrumentationLibrarySpans[0].spans[0];

          assert.ok(typeof span1 !== 'undefined', "span doesn't exist");
          if (span1) {
            ensureSpanIsCorrect(span1);
          }

          const resource = json.resourceSpans[0].resource;
          assert.ok(typeof resource !== 'undefined', "resource doesn't exist");
          if (resource) {
            ensureWebResourceIsCorrect(resource);
          }

          assert.strictEqual(url, 'http://foo.bar.com');
          assert.strictEqual(stubBeacon.callCount, 1);

          assert.strictEqual(stubOpen.callCount, 0);

          ensureExportTraceServiceRequestIsSet(json);

          done();
        });
      });

      it('should log the successful message', done => {
        // Need to stub/spy on the underlying logger as the "diag" instance is global
        const spyLoggerDebug = sinon.stub(diag, 'debug');
        const spyLoggerError = sinon.stub(diag, 'error');
        stubBeacon.returns(true);

        collectorTraceExporter.export(spans, () => {});

        setTimeout(() => {
          const response: any = spyLoggerDebug.args[1][0];
          assert.strictEqual(response, 'sendBeacon - can send');
          assert.strictEqual(spyLoggerError.args.length, 0);

          done();
        });
      });

      it('should log the error message', done => {
        stubBeacon.returns(false);

        collectorTraceExporter.export(spans, result => {
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
        collectorTraceExporter = new CollectorTraceExporter(
          collectorExporterConfig
        );
        server = sinon.fakeServer.create();
      });
      afterEach(() => {
        server.restore();
      });

      it('should successfully send the spans using XMLHttpRequest', done => {
        collectorTraceExporter.export(spans, () => {});

        setTimeout(() => {
          const request = server.requests[0];
          assert.strictEqual(request.method, 'POST');
          assert.strictEqual(request.url, 'http://foo.bar.com');

          const body = request.requestBody;
          const json = JSON.parse(
            body
          ) as collectorTypes.opentelemetryProto.collector.trace.v1.ExportTraceServiceRequest;
          const span1 =
            json.resourceSpans[0].instrumentationLibrarySpans[0].spans[0];

          assert.ok(typeof span1 !== 'undefined', "span doesn't exist");
          if (span1) {
            ensureSpanIsCorrect(span1);
          }

          const resource = json.resourceSpans[0].resource;
          assert.ok(typeof resource !== 'undefined', "resource doesn't exist");
          if (resource) {
            ensureWebResourceIsCorrect(resource);
          }

          assert.strictEqual(stubBeacon.callCount, 0);

          ensureExportTraceServiceRequestIsSet(json);

          done();
        });
      });

      it('should log the successful message', done => {
        // Need to stub/spy on the underlying logger as the "diag" instance is global
        const spyLoggerDebug = sinon.stub(diag, 'debug');
        const spyLoggerError = sinon.stub(diag, 'error');

        collectorTraceExporter.export(spans, () => {});

        setTimeout(() => {
          const request = server.requests[0];
          request.respond(200);

          const response: any = spyLoggerDebug.args[1][0];
          assert.strictEqual(response, 'xhr success');
          assert.strictEqual(spyLoggerError.args.length, 0);

          assert.strictEqual(stubBeacon.callCount, 0);
          done();
        });
      });

      it('should log the error message', done => {
        collectorTraceExporter.export(spans, result => {
          assert.deepStrictEqual(result.code, ExportResultCode.FAILED);
          assert.ok(result.error?.message.includes('Failed to export'));
          done();
        });

        setTimeout(() => {
          const request = server.requests[0];
          request.respond(400);
        });
      });

      it('should send custom headers', done => {
        collectorTraceExporter.export(spans, () => {});

        setTimeout(() => {
          const request = server.requests[0];
          request.respond(200);

          assert.strictEqual(stubBeacon.callCount, 0);
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

    beforeEach(() => {
      collectorExporterConfig = {
        headers: customHeaders,
      };
      server = sinon.fakeServer.create();
    });

    afterEach(() => {
      server.restore();
    });

    describe('when "sendBeacon" is available', () => {
      beforeEach(() => {
        collectorTraceExporter = new CollectorTraceExporter(
          collectorExporterConfig
        );
      });
      it('should successfully send custom headers using XMLHTTPRequest', done => {
        collectorTraceExporter.export(spans, () => {});

        setTimeout(() => {
          const [{ requestHeaders }] = server.requests;

          ensureHeadersContain(requestHeaders, customHeaders);
          assert.strictEqual(stubBeacon.callCount, 0);
          assert.strictEqual(stubOpen.callCount, 0);

          done();
        });
      });
    });

    describe('when "sendBeacon" is NOT available', () => {
      beforeEach(() => {
        (window.navigator as any).sendBeacon = false;
        collectorTraceExporter = new CollectorTraceExporter(
          collectorExporterConfig
        );
      });

      it('should successfully send spans using XMLHttpRequest', done => {
        collectorTraceExporter.export(spans, () => {});

        setTimeout(() => {
          const [{ requestHeaders }] = server.requests;

          ensureHeadersContain(requestHeaders, customHeaders);
          assert.strictEqual(stubBeacon.callCount, 0);
          assert.strictEqual(stubOpen.callCount, 0);

          done();
        });
      });
    });
  });
});

describe('CollectorTraceExporter - browser (getDefaultUrl)', () => {
  it('should default to v1/trace', done => {
    const collectorExporter = new CollectorTraceExporter({});
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

describe('when configuring via environment', () => {
  const envSource = window as any;
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
    const collectorExporter = new CollectorTraceExporter({ headers: {} });
    // @ts-expect-error access internal property for testing
    assert.strictEqual(collectorExporter._headers.foo, 'bar');
    envSource.OTEL_EXPORTER_OTLP_HEADERS = '';
  });
  it('should override global headers config with signal headers defined via env', () => {
    envSource.OTEL_EXPORTER_OTLP_HEADERS = 'foo=bar,bar=foo';
    envSource.OTEL_EXPORTER_OTLP_TRACES_HEADERS = 'foo=boo';
    const collectorExporter = new CollectorTraceExporter({ headers: {} });
    // @ts-expect-error access internal property for testing
    assert.strictEqual(collectorExporter._headers.foo, 'boo');
    // @ts-expect-error access internal property for testing
    assert.strictEqual(collectorExporter._headers.bar, 'foo');
    envSource.OTEL_EXPORTER_OTLP_TRACES_HEADERS = '';
    envSource.OTEL_EXPORTER_OTLP_HEADERS = '';
  });
});
