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

import { SpanKind, Span, context, propagation } from '@opentelemetry/api';
import {
  HttpFlavorValues,
  NetTransportValues,
  SemanticAttributes,
} from '@opentelemetry/semantic-conventions';
import * as assert from 'assert';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { Socket } from 'net';
import { assertSpan } from '../utils/assertSpan';
import * as url from 'url';
import * as utils from '../utils/utils';
import { NodeTracerProvider } from '@opentelemetry/sdk-node-tracing';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-base-tracing';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { HttpInstrumentation } from '../../src';

const instrumentation = new HttpInstrumentation();
instrumentation.enable();
instrumentation.disable();

import * as https from 'https';
import { httpsRequest } from '../utils/httpsRequest';
import { DummyPropagation } from '../utils/DummyPropagation';

const protocol = 'https';
const serverPort = 42345;
const hostname = 'localhost';
const memoryExporter = new InMemorySpanExporter();

export const customAttributeFunction = (span: Span): void => {
  span.setAttribute('span kind', SpanKind.CLIENT);
};

describe('HttpsInstrumentation Integration tests', () => {
  let mockServerPort = 0;
  let mockServer: https.Server;
  const sockets: Array<Socket> = [];
  before(done => {
    mockServer = https.createServer(
      {
        key: fs.readFileSync(
          path.join(__dirname, '..', 'fixtures', 'server-key.pem')
        ),
        cert: fs.readFileSync(
          path.join(__dirname, '..', 'fixtures', 'server-cert.pem')
        ),
      },
      (req, res) => {
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.write(
          JSON.stringify({
            success: true,
          })
        );
        res.end();
      }
    );

    mockServer.listen(0, () => {
      const addr = mockServer.address();
      if (addr == null) {
        done(new Error('unexpected addr null'));
        return;
      }

      if (typeof addr === 'string') {
        done(new Error(`unexpected addr ${addr}`));
        return;
      }

      if (addr.port <= 0) {
        done(new Error('Could not get port'));
        return;
      }
      mockServerPort = addr.port;
      done();
    });
  });

  after(done => {
    sockets.forEach(s => s.destroy());
    mockServer.close(done);
  });

  beforeEach(() => {
    memoryExporter.reset();
    context.setGlobalContextManager(new AsyncHooksContextManager().enable());
  });

  afterEach(() => {
    context.disable();
  });

  describe('enable()', () => {
    before(function (done) {
      // mandatory
      if (process.env.CI) {
        done();
        return;
      }

      utils.checkInternet(isConnected => {
        if (!isConnected) {
          this.skip();
          // don't disturb people
        }
        done();
      });
    });
    const provider = new NodeTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(memoryExporter));
    instrumentation.setTracerProvider(provider);
    beforeEach(() => {
      memoryExporter.reset();
    });

    before(() => {
      const ignoreConfig = [
        `${protocol}://${hostname}:${serverPort}/ignored/string`,
        /\/ignored\/regexp$/i,
        (url: string) => url.endsWith('/ignored/function'),
      ];
      propagation.setGlobalPropagator(new DummyPropagation());
      instrumentation.setConfig({
        ignoreIncomingPaths: ignoreConfig,
        ignoreOutgoingUrls: ignoreConfig,
        applyCustomAttributesOnSpan: customAttributeFunction,
      });
      instrumentation.enable();
    });

    after(() => {
      instrumentation.disable();
      propagation.disable();
    });

    it('should create a rootSpan for GET requests and add propagation headers', async () => {
      let spans = memoryExporter.getFinishedSpans();
      assert.strictEqual(spans.length, 0);

      const result = await httpsRequest.get(
        `${protocol}://localhost:${mockServerPort}/?query=test`
      );

      spans = memoryExporter.getFinishedSpans();
      const span = spans.find(s => s.kind === SpanKind.CLIENT);
      assert.ok(span);
      const validations = {
        hostname: 'localhost',
        httpStatusCode: result.statusCode!,
        httpMethod: 'GET',
        pathname: '/',
        path: '/?query=test',
        resHeaders: result.resHeaders,
        reqHeaders: result.reqHeaders,
        component: 'https',
      };

      assert.strictEqual(spans.length, 2);
      assert.strictEqual(span.name, 'HTTPS GET');
      assertSpan(span, SpanKind.CLIENT, validations);
    });

    it('should create a rootSpan for GET requests and add propagation headers if URL is used', async () => {
      let spans = memoryExporter.getFinishedSpans();
      assert.strictEqual(spans.length, 0);

      const result = await httpsRequest.get(
        new url.URL(`${protocol}://localhost:${mockServerPort}/?query=test`)
      );

      spans = memoryExporter.getFinishedSpans();
      const span = spans.find(s => s.kind === SpanKind.CLIENT);
      assert.ok(span);
      const validations = {
        hostname: 'localhost',
        httpStatusCode: result.statusCode!,
        httpMethod: 'GET',
        pathname: '/',
        path: '/?query=test',
        resHeaders: result.resHeaders,
        reqHeaders: result.reqHeaders,
        component: 'https',
      };

      assert.strictEqual(spans.length, 2);
      assert.strictEqual(span.name, 'HTTPS GET');
      assertSpan(span, SpanKind.CLIENT, validations);
    });

    it('should create a valid rootSpan with propagation headers for GET requests if URL and options are used', async () => {
      let spans = memoryExporter.getFinishedSpans();
      assert.strictEqual(spans.length, 0);

      const result = await httpsRequest.get(
        new url.URL(`${protocol}://localhost:${mockServerPort}/?query=test`),
        {
          headers: { 'x-foo': 'foo' },
        }
      );

      spans = memoryExporter.getFinishedSpans();
      const span = spans.find(s => s.kind === SpanKind.CLIENT);
      assert.ok(span);
      const validations = {
        hostname: 'localhost',
        httpStatusCode: result.statusCode!,
        httpMethod: 'GET',
        pathname: '/',
        path: '/?query=test',
        resHeaders: result.resHeaders,
        reqHeaders: result.reqHeaders,
        component: 'https',
      };

      assert.strictEqual(spans.length, 2);
      assert.strictEqual(span.name, 'HTTPS GET');
      assert.strictEqual(result.reqHeaders['x-foo'], 'foo');
      assert.strictEqual(
        span.attributes[SemanticAttributes.HTTP_FLAVOR],
        HttpFlavorValues.HTTP_1_1
      );
      assert.strictEqual(
        span.attributes[SemanticAttributes.NET_TRANSPORT],
        NetTransportValues.IP_TCP
      );
      assertSpan(span, SpanKind.CLIENT, validations);
    });

    it('custom attributes should show up on client spans', async () => {
      const result = await httpsRequest.get(
        `${protocol}://localhost:${mockServerPort}/`
      );
      const spans = memoryExporter.getFinishedSpans();
      const span = spans.find(s => s.kind === SpanKind.CLIENT);
      assert.ok(span);
      const validations = {
        hostname: 'localhost',
        httpStatusCode: result.statusCode!,
        httpMethod: 'GET',
        pathname: '/',
        resHeaders: result.resHeaders,
        reqHeaders: result.reqHeaders,
        component: 'https',
      };

      assert.strictEqual(spans.length, 2);
      assert.strictEqual(span.name, 'HTTPS GET');
      assert.strictEqual(span.attributes['span kind'], SpanKind.CLIENT);
      assertSpan(span, SpanKind.CLIENT, validations);
    });

    it('should create a span for GET requests and add propagation headers with Expect headers', async () => {
      let spans = memoryExporter.getFinishedSpans();
      assert.strictEqual(spans.length, 0);
      const options = Object.assign(
        { headers: { Expect: '100-continue' } },
        url.parse(`${protocol}://localhost:${mockServerPort}/`)
      );

      const result = await httpsRequest.get(options);
      spans = memoryExporter.getFinishedSpans();
      const span = spans.find(s => s.kind === SpanKind.CLIENT);
      assert.ok(span);
      const validations = {
        hostname: 'localhost',
        httpStatusCode: 200,
        httpMethod: 'GET',
        pathname: '/',
        resHeaders: result.resHeaders,
        reqHeaders: result.reqHeaders,
        component: 'https',
      };

      assert.strictEqual(spans.length, 2);
      assert.strictEqual(span.name, 'HTTPS GET');
      assertSpan(span, SpanKind.CLIENT, validations);
    });
    for (const headers of [
      { Expect: '100-continue', 'user-agent': 'http-plugin-test' },
      { 'user-agent': 'http-plugin-test' },
    ]) {
      it(`should create a span for GET requests and add propagation when using the following signature: get(url, options, callback) and following headers: ${JSON.stringify(
        headers
      )}`, done => {
        let validations: {
          hostname: string;
          httpStatusCode: number;
          httpMethod: string;
          pathname: string;
          reqHeaders: http.OutgoingHttpHeaders;
          resHeaders: http.IncomingHttpHeaders;
        };
        let data = '';
        const spans = memoryExporter.getFinishedSpans();
        assert.strictEqual(spans.length, 0);
        const options = { headers };
        const req = https.get(
          `${protocol}://localhost:${mockServerPort}/`,
          options,
          (resp: http.IncomingMessage) => {
            const res = (resp as unknown) as http.IncomingMessage & {
              req: http.IncomingMessage;
            };

            resp.on('data', chunk => {
              data += chunk;
            });
            resp.on('end', () => {
              validations = {
                hostname: 'localhost',
                httpStatusCode: 301,
                httpMethod: 'GET',
                pathname: '/',
                resHeaders: resp.headers,
                /* tslint:disable:no-any */
                reqHeaders: (res.req as any).getHeaders
                  ? (res.req as any).getHeaders()
                  : (res.req as any)._headers,
                /* tslint:enable:no-any */
              };
            });
          }
        );

        req.on('close', () => {
          const spans = memoryExporter.getFinishedSpans();
          const span = spans.find(s => s.kind === SpanKind.CLIENT);
          assert.ok(span);
          assert.strictEqual(spans.length, 2);
          assert.strictEqual(span.name, 'HTTPS GET');
          assert.ok(data);
          assert.ok(validations.reqHeaders[DummyPropagation.TRACE_CONTEXT_KEY]);
          assert.ok(validations.reqHeaders[DummyPropagation.SPAN_CONTEXT_KEY]);
          done();
        });
      });
    }
  });
});
