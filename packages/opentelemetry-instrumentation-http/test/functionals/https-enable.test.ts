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
  SpanStatusCode,
  context,
  propagation,
  Span as ISpan,
  SpanKind,
  trace,
} from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { ContextManager } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/tracing';
import {
  NetTransportValues,
  SemanticAttributes,
} from '@opentelemetry/semantic-conventions';
import * as assert from 'assert';
import * as fs from 'fs';
import * as semver from 'semver';
import * as nock from 'nock';
import * as path from 'path';
import { HttpInstrumentation } from '../../src/http';
import { assertSpan } from '../utils/assertSpan';
import { DummyPropagation } from '../utils/DummyPropagation';
import { isWrapped } from '@opentelemetry/instrumentation';

const instrumentation = new HttpInstrumentation();
instrumentation.enable();
instrumentation.disable();

import * as http from 'http';
import * as https from 'https';
import { httpsRequest } from '../utils/httpsRequest';

const applyCustomAttributesOnSpanErrorMessage =
  'bad applyCustomAttributesOnSpan function';

let server: https.Server;
const serverPort = 32345;
const protocol = 'https';
const hostname = 'localhost';
const serverName = 'my.server.name';
const pathname = '/test';
const memoryExporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider();
instrumentation.setTracerProvider(provider);
const tracer = provider.getTracer('test-https');
provider.addSpanProcessor(new SimpleSpanProcessor(memoryExporter));

function doNock(
  hostname: string,
  path: string,
  httpCode: number,
  respBody: string,
  times?: number
) {
  const i = times || 1;
  nock(`${protocol}://${hostname}`)
    .get(path)
    .times(i)
    .reply(httpCode, respBody);
}

export const customAttributeFunction = (span: ISpan): void => {
  span.setAttribute('span kind', SpanKind.CLIENT);
};

describe('HttpsInstrumentation', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new AsyncHooksContextManager().enable();
    propagation.setGlobalPropagator(new DummyPropagation());
    context.setGlobalContextManager(contextManager);
  });

  afterEach(() => {
    contextManager.disable();
    context.disable();
    propagation.disable();
  });

  describe('enable()', () => {
    describe('with bad instrumentation options', () => {
      beforeEach(() => {
        memoryExporter.reset();
      });

      before(() => {
        instrumentation.setConfig({
          ignoreIncomingPaths: [
            (url: string) => {
              throw new Error('bad ignoreIncomingPaths function');
            },
          ],
          ignoreOutgoingUrls: [
            (url: string) => {
              throw new Error('bad ignoreOutgoingUrls function');
            },
          ],
          applyCustomAttributesOnSpan: () => {
            throw new Error(applyCustomAttributesOnSpanErrorMessage);
          },
        });
        instrumentation.enable();
        server = https.createServer(
          {
            key: fs.readFileSync('test/fixtures/server-key.pem'),
            cert: fs.readFileSync('test/fixtures/server-cert.pem'),
          },
          (request, response) => {
            response.end('Test Server Response');
          }
        );

        server.listen(serverPort);
      });

      after(() => {
        server.close();
        instrumentation.disable();
      });

      it('should generate valid spans (client side and server side)', async () => {
        const result = await httpsRequest.get(
          `${protocol}://${hostname}:${serverPort}${pathname}`
        );
        const spans = memoryExporter.getFinishedSpans();
        const [incomingSpan, outgoingSpan] = spans;
        const validations = {
          hostname,
          httpStatusCode: result.statusCode!,
          httpMethod: result.method!,
          pathname,
          resHeaders: result.resHeaders,
          reqHeaders: result.reqHeaders,
          component: 'https',
        };

        assert.strictEqual(spans.length, 2);
        assertSpan(incomingSpan, SpanKind.SERVER, validations);
        assertSpan(outgoingSpan, SpanKind.CLIENT, validations);
        assert.strictEqual(
          incomingSpan.attributes[SemanticAttributes.NET_HOST_PORT],
          serverPort
        );
        assert.strictEqual(
          outgoingSpan.attributes[SemanticAttributes.NET_PEER_PORT],
          serverPort
        );
      });
    });
    describe('with good instrumentation options', () => {
      beforeEach(() => {
        memoryExporter.reset();
      });

      before(() => {
        instrumentation.setConfig({
          ignoreIncomingPaths: [
            '/ignored/string',
            /\/ignored\/regexp$/i,
            (url: string) => url.endsWith('/ignored/function'),
          ],
          ignoreOutgoingUrls: [
            `${protocol}://${hostname}:${serverPort}/ignored/string`,
            /\/ignored\/regexp$/i,
            (url: string) => url.endsWith('/ignored/function'),
          ],
          applyCustomAttributesOnSpan: customAttributeFunction,
          serverName,
        });
        instrumentation.enable();
        server = https.createServer(
          {
            key: fs.readFileSync('test/fixtures/server-key.pem'),
            cert: fs.readFileSync('test/fixtures/server-cert.pem'),
          },
          (request, response) => {
            if (request.url?.includes('/ignored')) {
              tracer.startSpan('some-span').end();
            }
            response.end('Test Server Response');
          }
        );

        server.listen(serverPort);
      });

      after(() => {
        server.close();
        instrumentation.disable();
      });

      it(`${protocol} module should be patched`, () => {
        assert.strictEqual(isWrapped(https.Server.prototype.emit), true);
      });

      it('should generate valid spans (client side and server side)', async () => {
        const result = await httpsRequest.get(
          `${protocol}://${hostname}:${serverPort}${pathname}`,
          {
            headers: {
              'x-forwarded-for': '<client>, <proxy1>, <proxy2>',
              'user-agent': 'chrome',
            },
          }
        );
        const spans = memoryExporter.getFinishedSpans();
        const [incomingSpan, outgoingSpan] = spans;
        const validations = {
          hostname,
          httpStatusCode: result.statusCode!,
          httpMethod: result.method!,
          pathname,
          resHeaders: result.resHeaders,
          reqHeaders: result.reqHeaders,
          component: 'https',
          serverName,
        };

        assert.strictEqual(spans.length, 2);
        assert.strictEqual(
          incomingSpan.attributes[SemanticAttributes.HTTP_CLIENT_IP],
          '<client>'
        );
        assert.strictEqual(
          incomingSpan.attributes[SemanticAttributes.NET_HOST_PORT],
          serverPort
        );
        assert.strictEqual(
          outgoingSpan.attributes[SemanticAttributes.NET_PEER_PORT],
          serverPort
        );

        [
          { span: incomingSpan, kind: SpanKind.SERVER },
          { span: outgoingSpan, kind: SpanKind.CLIENT },
        ].forEach(({ span, kind }) => {
          assert.strictEqual(
            span.attributes[SemanticAttributes.HTTP_FLAVOR],
            '1.1'
          );
          assert.strictEqual(
            span.attributes[SemanticAttributes.NET_TRANSPORT],
            NetTransportValues.IP_TCP
          );
          assertSpan(span, kind, validations);
        });
      });

      const httpErrorCodes = [400, 401, 403, 404, 429, 501, 503, 504, 500, 505];

      for (let i = 0; i < httpErrorCodes.length; i++) {
        it(`should test span for GET requests with http error ${httpErrorCodes[i]}`, async () => {
          const testPath = '/outgoing/rootSpan/1';

          doNock(
            hostname,
            testPath,
            httpErrorCodes[i],
            httpErrorCodes[i].toString()
          );

          const isReset = memoryExporter.getFinishedSpans().length === 0;
          assert.ok(isReset);

          const result = await httpsRequest.get(
            `${protocol}://${hostname}${testPath}`
          );
          const spans = memoryExporter.getFinishedSpans();
          const reqSpan = spans[0];

          assert.strictEqual(result.data, httpErrorCodes[i].toString());
          assert.strictEqual(spans.length, 1);

          const validations = {
            hostname,
            httpStatusCode: result.statusCode!,
            httpMethod: 'GET',
            pathname: testPath,
            resHeaders: result.resHeaders,
            reqHeaders: result.reqHeaders,
            component: 'https',
          };

          assertSpan(reqSpan, SpanKind.CLIENT, validations);
        });
      }

      it('should create a child span for GET requests', async () => {
        const testPath = '/outgoing/rootSpan/childs/1';
        doNock(hostname, testPath, 200, 'Ok');
        const name = 'TestRootSpan';
        const span = tracer.startSpan(name);
        return context.with(trace.setSpan(context.active(), span), async () => {
          const result = await httpsRequest.get(
            `${protocol}://${hostname}${testPath}`
          );
          span.end();
          const spans = memoryExporter.getFinishedSpans();
          const [reqSpan, localSpan] = spans;
          const validations = {
            hostname,
            httpStatusCode: result.statusCode!,
            httpMethod: 'GET',
            pathname: testPath,
            resHeaders: result.resHeaders,
            reqHeaders: result.reqHeaders,
            component: 'https',
          };

          assert.ok(localSpan.name.indexOf('TestRootSpan') >= 0);
          assert.strictEqual(spans.length, 2);
          assert.strictEqual(reqSpan.name, 'HTTPS GET');
          assert.strictEqual(
            localSpan.spanContext().traceId,
            reqSpan.spanContext().traceId
          );
          assertSpan(reqSpan, SpanKind.CLIENT, validations);
          assert.notStrictEqual(
            localSpan.spanContext().spanId,
            reqSpan.spanContext().spanId
          );
        });
      });

      for (let i = 0; i < httpErrorCodes.length; i++) {
        it(`should test child spans for GET requests with http error ${httpErrorCodes[i]}`, async () => {
          const testPath = '/outgoing/rootSpan/childs/1';
          doNock(
            hostname,
            testPath,
            httpErrorCodes[i],
            httpErrorCodes[i].toString()
          );
          const name = 'TestRootSpan';
          const span = tracer.startSpan(name);
          return context.with(trace.setSpan(context.active(), span), async () => {
            const result = await httpsRequest.get(
              `${protocol}://${hostname}${testPath}`
            );
            span.end();
            const spans = memoryExporter.getFinishedSpans();
            const [reqSpan, localSpan] = spans;
            const validations = {
              hostname,
              httpStatusCode: result.statusCode!,
              httpMethod: 'GET',
              pathname: testPath,
              resHeaders: result.resHeaders,
              reqHeaders: result.reqHeaders,
              component: 'https',
            };

            assert.ok(localSpan.name.indexOf('TestRootSpan') >= 0);
            assert.strictEqual(spans.length, 2);
            assert.strictEqual(reqSpan.name, 'HTTPS GET');
            assert.strictEqual(
              localSpan.spanContext().traceId,
              reqSpan.spanContext().traceId
            );
            assertSpan(reqSpan, SpanKind.CLIENT, validations);
            assert.notStrictEqual(
              localSpan.spanContext().spanId,
              reqSpan.spanContext().spanId
            );
          });
        });
      }

      it('should create multiple child spans for GET requests', async () => {
        const testPath = '/outgoing/rootSpan/childs';
        const num = 5;
        doNock(hostname, testPath, 200, 'Ok', num);
        const name = 'TestRootSpan';
        const span = tracer.startSpan(name);
        await context.with(trace.setSpan(context.active(), span), async () => {
          for (let i = 0; i < num; i++) {
            await httpsRequest.get(`${protocol}://${hostname}${testPath}`);
            const spans = memoryExporter.getFinishedSpans();
            assert.strictEqual(spans[i].name, 'HTTPS GET');
            assert.strictEqual(
              span.spanContext().traceId,
              spans[i].spanContext().traceId
            );
          }
          span.end();
          const spans = memoryExporter.getFinishedSpans();
          // 5 child spans ended + 1 span (root)
          assert.strictEqual(spans.length, 6);
        });
      });

      for (const ignored of ['string', 'function', 'regexp']) {
        it(`should not trace ignored requests (client and server side) with type ${ignored}`, async () => {
          const testPath = `/ignored/${ignored}`;

          await httpsRequest.get(
            `${protocol}://${hostname}:${serverPort}${testPath}`
          );
          const spans = memoryExporter.getFinishedSpans();
          assert.strictEqual(spans.length, 0);
        });
      }

      for (const arg of ['string', {}, new Date()]) {
        it(`should be tracable and not throw exception in ${protocol} instrumentation when passing the following argument ${JSON.stringify(
          arg
        )}`, async () => {
          try {
            await httpsRequest.get(arg);
          } catch (error) {
            // request has been made
            // nock throw
            assert.ok(error.message.startsWith('Nock: No match for request'));
          }
          const spans = memoryExporter.getFinishedSpans();
          assert.strictEqual(spans.length, 1);
        });
      }

      for (const arg of [true, 1, false, 0, '']) {
        it(`should not throw exception in https instrumentation when passing the following argument ${JSON.stringify(
          arg
        )}`, async () => {
          try {
            await httpsRequest.get(arg as any);
          } catch (error) {
            // request has been made
            // nock throw
            assert.ok(
              error.stack.indexOf(
                path.normalize('/node_modules/nock/lib/intercept.js')
              ) > 0
            );
          }
          const spans = memoryExporter.getFinishedSpans();
          // for this arg with don't provide trace. We pass arg to original method (https.get)
          assert.strictEqual(spans.length, 0);
        });
      }

      it('should have 1 ended span when request throw on bad "options" object', () => {
        try {
          https.request({ protocol: 'telnet' });
        } catch (error) {
          const spans = memoryExporter.getFinishedSpans();
          assert.strictEqual(spans.length, 1);
        }
      });

      it('should have 1 ended span when response.end throw an exception', async () => {
        const testPath = '/outgoing/rootSpan/childs/1';
        doNock(hostname, testPath, 400, 'Not Ok');

        const promiseRequest = new Promise((resolve, reject) => {
          const req = https.request(
            `${protocol}://${hostname}${testPath}`,
            (resp: http.IncomingMessage) => {
              let data = '';
              resp.on('data', chunk => {
                data += chunk;
              });
              resp.on('end', () => {
                reject(new Error(data));
              });
            }
          );
          return req.end();
        });

        try {
          await promiseRequest;
          assert.fail();
        } catch (error) {
          const spans = memoryExporter.getFinishedSpans();
          assert.strictEqual(spans.length, 1);
        }
      });

      it('should have 1 ended span when request throw on bad "options" object', () => {
        nock.cleanAll();
        nock.enableNetConnect();
        try {
          https.request({ protocol: 'telnet' });
          assert.fail();
        } catch (error) {
          const spans = memoryExporter.getFinishedSpans();
          /**
           * There is an edge case with node 8 because the https module
           * just call the http one, resulting in 2 span. The fix only works
           * if the protocol is 'https:' resulting in 2 span only for this test.
           */
          assert.strictEqual(
            spans.length,
            semver.gt(process.version, '9.0.0') ? 1 : 2
          );
        }
      });

      it('should have 2 ended spans when provided "options" are an object without a constructor', async () => {
        // Related issue: https://github.com/open-telemetry/opentelemetry-js/issues/2008
        const testPath = '/outgoing/test';
        const options = Object.create(null);
        options.hostname = hostname;
        options.port = serverPort;
        options.path = pathname;
        options.method = 'GET';

        doNock(hostname, testPath, 200, 'Ok');

        const promiseRequest = new Promise((resolve, _reject) => {
          const req = https.request(options, (resp: http.IncomingMessage) => {
            resp.on('data', () => {});
            resp.on('end', () => {
              resolve({});
            });
          });
          return req.end();
        });

        await promiseRequest;
        const spans = memoryExporter.getFinishedSpans();
        assert.strictEqual(spans.length, 2);
      });

      it('should have 1 ended span when response.end throw an exception', async () => {
        const testPath = '/outgoing/rootSpan/childs/1';
        doNock(hostname, testPath, 400, 'Not Ok');

        const promiseRequest = new Promise((resolve, reject) => {
          const req = https.request(
            `${protocol}://${hostname}${testPath}`,
            (resp: http.IncomingMessage) => {
              let data = '';
              resp.on('data', chunk => {
                data += chunk;
              });
              resp.on('end', () => {
                reject(new Error(data));
              });
            }
          );
          return req.end();
        });

        try {
          await promiseRequest;
          assert.fail();
        } catch (error) {
          const spans = memoryExporter.getFinishedSpans();
          assert.strictEqual(spans.length, 1);
        }
      });

      it('should have 1 ended span when request is aborted', async () => {
        nock(`${protocol}://my.server.com`)
          .get('/')
          .delayConnection(50)
          .reply(200, '<html></html>');

        const promiseRequest = new Promise((resolve, reject) => {
          const req = https.request(
            `${protocol}://my.server.com`,
            (resp: http.IncomingMessage) => {
              let data = '';
              resp.on('data', chunk => {
                data += chunk;
              });
              resp.on('end', () => {
                resolve(data);
              });
            }
          );
          req.setTimeout(10, () => {
            req.abort();
            reject('timeout');
          });
          return req.end();
        });

        try {
          await promiseRequest;
          assert.fail();
        } catch (error) {
          const spans = memoryExporter.getFinishedSpans();
          const [span] = spans;
          assert.strictEqual(spans.length, 1);
          assert.strictEqual(span.status.code, SpanStatusCode.ERROR);
          assert.ok(Object.keys(span.attributes).length >= 6);
        }
      });

      it('should have 1 ended span when request is aborted after receiving response', async () => {
        nock(`${protocol}://my.server.com`)
          .get('/')
          .delay({
            body: 50,
          })
          .replyWithFile(200, `${process.cwd()}/package.json`);

        const promiseRequest = new Promise((resolve, reject) => {
          const req = https.request(
            `${protocol}://my.server.com`,
            (resp: http.IncomingMessage) => {
              let data = '';
              resp.on('data', chunk => {
                req.destroy(Error());
                data += chunk;
              });
              resp.on('end', () => {
                resolve(data);
              });
            }
          );

          return req.end();
        });

        try {
          await promiseRequest;
          assert.fail();
        } catch (error) {
          const spans = memoryExporter.getFinishedSpans();
          const [span] = spans;
          assert.strictEqual(spans.length, 1);
          assert.strictEqual(span.status.code, SpanStatusCode.ERROR);
          assert.ok(Object.keys(span.attributes).length > 7);
        }
      });

      it("should have 1 ended span when response is listened by using req.on('response')", done => {
        const host = `${protocol}://${hostname}`;
        nock(host).get('/').reply(404);
        const req = https.request(`${host}/`);
        req.on('response', response => {
          response.on('data', () => {});
          response.on('end', () => {
            const spans = memoryExporter.getFinishedSpans();
            const [span] = spans;
            assert.strictEqual(spans.length, 1);
            assert.ok(Object.keys(span.attributes).length > 6);
            assert.strictEqual(
              span.attributes[SemanticAttributes.HTTP_STATUS_CODE],
              404
            );
            assert.strictEqual(span.status.code, SpanStatusCode.ERROR);
            done();
          });
        });
        req.end();
      });
    });
  });
});
