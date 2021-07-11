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
  setGlobalErrorHandler,
  loggingErrorHandler,
} from '@opentelemetry/core';
import { ReadableSpan } from '@opentelemetry/sdk-base-tracing';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { ZipkinExporter } from '../../src';
import * as zipkinTypes from '../../src/types';
import {
  ensureHeadersContain,
  ensureSpanIsCorrect,
  mockedReadableSpan,
} from '../helper';

const sendBeacon = navigator.sendBeacon;

describe('Zipkin Exporter - web', () => {
  let zipkinExporter: ZipkinExporter;
  let zipkinConfig: zipkinTypes.ExporterConfig = {};
  let spySend: sinon.SinonSpy;
  let spyBeacon: sinon.SinonSpy;
  let spans: ReadableSpan[];

  beforeEach(() => {
    spySend = sinon.stub(XMLHttpRequest.prototype, 'send');
    spyBeacon = sinon.stub(navigator, 'sendBeacon');
    spans = [];
    spans.push(Object.assign({}, mockedReadableSpan));
  });

  afterEach(() => {
    sinon.restore();
    navigator.sendBeacon = sendBeacon;
  });

  describe('export', () => {
    describe('when "sendBeacon" is available', () => {
      beforeEach(() => {
        zipkinExporter = new ZipkinExporter(zipkinConfig);
      });

      it('should successfully send the spans using sendBeacon', done => {
        zipkinExporter.export(spans, () => {});

        setTimeout(() => {
          const args = spyBeacon.args[0];
          const body = args[1];
          const json = JSON.parse(body) as any;
          ensureSpanIsCorrect(json[0]);
          assert.strictEqual(spyBeacon.callCount, 1);
          assert.strictEqual(spySend.callCount, 0);

          done();
        });
      });
    });

    describe('when "sendBeacon" is NOT available', () => {
      let server: any;
      beforeEach(() => {
        (window.navigator as any).sendBeacon = false;
        zipkinExporter = new ZipkinExporter(zipkinConfig);
        server = sinon.fakeServer.create();
      });
      afterEach(() => {
        server.restore();
      });

      it('should successfully send the spans using XMLHttpRequest', done => {
        zipkinExporter.export(spans, () => {});

        setTimeout(() => {
          const request = server.requests[0];
          const body = request.requestBody;
          const json = JSON.parse(body) as any;
          ensureSpanIsCorrect(json[0]);

          done();
        });
      });
    });

    describe('should use url defined in environment', () => {
      let server: any;
      const endpointUrl = 'http://localhost:9412';
      beforeEach(() => {
        (window.navigator as any).sendBeacon = false;
        (window as any).OTEL_EXPORTER_ZIPKIN_ENDPOINT = endpointUrl;
        zipkinExporter = new ZipkinExporter(zipkinConfig);
        server = sinon.fakeServer.create();
      });
      afterEach(() => {
        server.restore();
      });

      it('should successfully send the spans using XMLHttpRequest', done => {
        zipkinExporter.export(spans, () => {});

        setTimeout(() => {
          const request = server.requests[0];
          assert(request.url, endpointUrl);
          const body = request.requestBody;
          const json = JSON.parse(body) as any;
          ensureSpanIsCorrect(json[0]);

          done();
        });
      });
    });
  });
  describe('when getExportRequestHeaders is defined', () => {
    let server: any;
    beforeEach(() => {
      server = sinon.fakeServer.create();
      spySend.restore();
    });

    afterEach(() => {
      server.restore();
    });

    it('should add headers from callback', done => {
      zipkinExporter = new ZipkinExporter({
        getExportRequestHeaders: () => {
          return {
            foo1: 'bar1',
            foo2: 'bar2',
          };
        },
      });
      zipkinExporter.export(spans, () => {});

      setTimeout(() => {
        const [{ requestHeaders }] = server.requests;

        ensureHeadersContain(requestHeaders, {
          foo1: 'bar1',
          foo2: 'bar2',
        });

        done();
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
      zipkinConfig = {
        headers: customHeaders,
      };
      server = sinon.fakeServer.create();
    });

    afterEach(() => {
      server.restore();
    });

    describe('when "sendBeacon" is available', () => {
      beforeEach(() => {
        zipkinExporter = new ZipkinExporter(zipkinConfig);
      });
      it('should successfully send custom headers using XMLHTTPRequest', done => {
        zipkinExporter.export(spans, () => {});

        setTimeout(() => {
          const [{ requestHeaders }] = server.requests;

          ensureHeadersContain(requestHeaders, customHeaders);
          assert.strictEqual(spyBeacon.callCount, 0);

          done();
        });
      });

      it('should call globalErrorHandler on error', () => {
        const errorHandlerSpy = sinon.spy();
        setGlobalErrorHandler(errorHandlerSpy);

        zipkinExporter.export(spans, () => {
          const [[error]] = errorHandlerSpy.args;
          assert.strictEqual(errorHandlerSpy.callCount, 1);
          assert.ok(error.message.includes('Zipkin request error'));

          //reset global error handler
          setGlobalErrorHandler(loggingErrorHandler());
        });

        setTimeout(() => {
          const request = server.requests[0];
          request.respond(400);
        });
      });
    });

    describe('when "sendBeacon" is NOT available', () => {
      beforeEach(() => {
        (window.navigator as any).sendBeacon = false;
        zipkinExporter = new ZipkinExporter(zipkinConfig);
      });

      it('should successfully send custom headers using XMLHTTPRequest', done => {
        zipkinExporter.export(spans, () => {});

        setTimeout(() => {
          const [{ requestHeaders }] = server.requests;

          ensureHeadersContain(requestHeaders, customHeaders);
          assert.strictEqual(spyBeacon.callCount, 0);

          done();
        });
      });

      it('should call globalErrorHandler on error', () => {
        const errorHandlerSpy = sinon.spy();
        setGlobalErrorHandler(errorHandlerSpy);

        zipkinExporter.export(spans, () => {
          const [[error]] = errorHandlerSpy.args;
          assert.strictEqual(errorHandlerSpy.callCount, 1);
          assert.ok(error.message.includes('sendBeacon - cannot send'));

          //reset global error handler
          setGlobalErrorHandler(loggingErrorHandler());
        });

        setTimeout(() => {
          const request = server.requests[0];
          request.respond(400);
        });
      });
    });
  });
});
