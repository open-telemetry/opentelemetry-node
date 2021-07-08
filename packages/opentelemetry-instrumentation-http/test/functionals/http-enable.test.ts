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
  SpanAttributes,
} from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/node';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/tracing';
import {
  NetTransportValues,
  SemanticAttributes,
} from '@opentelemetry/semantic-conventions';
import * as assert from 'assert';
import * as nock from 'nock';
import * as path from 'path';
import { HttpInstrumentation } from '../../src/http';
import { HttpInstrumentationConfig } from '../../src/types';
import { assertSpan } from '../utils/assertSpan';
import { DummyPropagation } from '../utils/DummyPropagation';
import { httpRequest } from '../utils/httpRequest';
import { ContextManager } from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import type { ClientRequest, IncomingMessage, ServerResponse, RequestOptions } from 'http';
import { isWrapped } from '@opentelemetry/instrumentation';
import { getRPCMetadata, RPCType } from '@opentelemetry/core';

const instrumentation = new HttpInstrumentation();
instrumentation.enable();
instrumentation.disable();

import * as http from 'http';

const applyCustomAttributesOnSpanErrorMessage =
  'bad applyCustomAttributesOnSpan function';

let server: http.Server;
const serverPort = 22346;
const protocol = 'http';
const hostname = 'localhost';
const pathname = '/test';
const serverName = 'my.server.name';
const memoryExporter = new InMemorySpanExporter();
const provider = new NodeTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(memoryExporter));
instrumentation.setTracerProvider(provider);

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

export const requestHookFunction = (
  span: ISpan,
  request: ClientRequest | IncomingMessage
): void => {
  span.setAttribute('custom request hook attribute', 'request');
};

export const responseHookFunction = (
  span: ISpan,
  response: IncomingMessage | ServerResponse
): void => {
  span.setAttribute('custom response hook attribute', 'response');
};

export const startIncomingSpanHookFunction = (
  request: IncomingMessage
): SpanAttributes => {
  return {guid: request.headers?.guid}
};

export const startOutgoingSpanHookFunction = (
  request: RequestOptions
): SpanAttributes => {
  return {guid: request.headers?.guid}
};

describe('HttpInstrumentation', () => {
  let contextManager: ContextManager;

  before(() => {
    propagation.setGlobalPropagator(new DummyPropagation());
  });

  after(() => {
    propagation.disable();
  });

  beforeEach(() => {
    contextManager = new AsyncHooksContextManager().enable();
    context.setGlobalContextManager(contextManager);
  });

  afterEach(() => {
    context.disable();
  });

  describe('enable()', () => {
    describe('with bad instrumentation options', () => {
      beforeEach(() => {
        memoryExporter.reset();
      });

      before(() => {
        const config: HttpInstrumentationConfig = {
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
        };
        instrumentation.setConfig(config);
        instrumentation.enable();
        server = http.createServer((request, response) => {
          response.end('Test Server Response');
        });

        server.listen(serverPort);
      });

      after(() => {
        server.close();
        instrumentation.disable();
      });

      it('should generate valid spans (client side and server side)', async () => {
        const result = await httpRequest.get(
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
          component: 'http',
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
          requestHook: requestHookFunction,
          responseHook: responseHookFunction,
          startIncomingSpanHook: startIncomingSpanHookFunction,
          startOutgoingSpanHook: startOutgoingSpanHookFunction,
          serverName,
        });
        instrumentation.enable();
        server = http.createServer((request, response) => {
          if (request.url?.includes('/ignored')) {
            provider.getTracer('test').startSpan('some-span').end();
          }
          response.end('Test Server Response');
        });

        server.listen(serverPort);
      });

      after(() => {
        server.close();
        instrumentation.disable();
      });

      it(`${protocol} module should be patched`, () => {
        assert.strictEqual(isWrapped(http.Server.prototype.emit), true);
      });

      it('should generate valid spans (client side and server side)', async () => {
        const result = await httpRequest.get(
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
          component: 'http',
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

      const httpErrorCodes = [
        400,
        401,
        403,
        404,
        429,
        501,
        503,
        504,
        500,
        505,
        597,
      ];

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

          const result = await httpRequest.get(
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
            component: 'http',
          };

          assertSpan(reqSpan, SpanKind.CLIENT, validations);
        });
      }

      it('should create a child span for GET requests', async () => {
        const testPath = '/outgoing/rootSpan/childs/1';
        doNock(hostname, testPath, 200, 'Ok');
        const name = 'TestRootSpan';
        const span = provider.getTracer('default').startSpan(name);
        return context.with(trace.setSpan(context.active(), span), async () => {
          const result = await httpRequest.get(
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
            component: 'http',
          };

          assert.ok(localSpan.name.indexOf('TestRootSpan') >= 0);
          assert.strictEqual(spans.length, 2);
          assert.strictEqual(reqSpan.name, 'HTTP GET');
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
          const span = provider.getTracer('default').startSpan(name);
          return context.with(trace.setSpan(context.active(), span), async () => {
            const result = await httpRequest.get(
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
              component: 'http',
            };

            assert.ok(localSpan.name.indexOf('TestRootSpan') >= 0);
            assert.strictEqual(spans.length, 2);
            assert.strictEqual(reqSpan.name, 'HTTP GET');
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
        const span = provider.getTracer('default').startSpan(name);
        await context.with(trace.setSpan(context.active(), span), async () => {
          for (let i = 0; i < num; i++) {
            await httpRequest.get(`${protocol}://${hostname}${testPath}`);
            const spans = memoryExporter.getFinishedSpans();
            assert.strictEqual(spans[i].name, 'HTTP GET');
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

          await httpRequest.get(
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
            await httpRequest.get(arg);
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
        it(`should not throw exception in ${protocol} instrumentation when passing the following argument ${JSON.stringify(
          arg
        )}`, async () => {
          try {
            await httpRequest.get(arg as any);
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
          // for this arg with don't provide trace. We pass arg to original method (http.get)
          assert.strictEqual(spans.length, 0);
        });
      }

      it('should have 1 ended span when request throw on bad "options" object', () => {
        try {
          http.request({ protocol: 'telnet' });
        } catch (error) {
          const spans = memoryExporter.getFinishedSpans();
          assert.strictEqual(spans.length, 1);
        }
      });

      it('should have 1 ended span when response.end throw an exception', async () => {
        const testPath = '/outgoing/rootSpan/childs/1';
        doNock(hostname, testPath, 400, 'Not Ok');

        const promiseRequest = new Promise((resolve, reject) => {
          const req = http.request(
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
          http.request({ protocol: 'telnet' });
          assert.fail();
        } catch (error) {
          const spans = memoryExporter.getFinishedSpans();
          assert.strictEqual(spans.length, 1);
        }
      });

      it('should have 1 ended span when response.end throw an exception', async () => {
        const testPath = '/outgoing/rootSpan/childs/1';
        doNock(hostname, testPath, 400, 'Not Ok');

        const promiseRequest = new Promise((resolve, reject) => {
          const req = http.request(
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
          .socketDelay(50)
          .reply(200, '<html></html>');

        const promiseRequest = new Promise((resolve, reject) => {
          const req = http.request(
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
          const req = http.request(
            `${protocol}://my.server.com`,
            (resp: http.IncomingMessage) => {
              let data = '';
              resp.on('data', chunk => {
                req.abort();
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

      it("should have 1 ended span when request doesn't listening response", done => {
        nock.cleanAll();
        nock.enableNetConnect();
        const req = http.request(`${protocol}://${hostname}/`);
        req.on('close', () => {
          const spans = memoryExporter.getFinishedSpans();
          const [span] = spans;
          assert.strictEqual(spans.length, 1);
          assert.ok(Object.keys(span.attributes).length > 6);
          done();
        });
        req.end();
      });

      it("should have 1 ended span when response is listened by using req.on('response')", done => {
        const host = `${protocol}://${hostname}`;
        nock(host).get('/').reply(404);
        const req = http.request(`${host}/`);
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

      it('custom attributes should show up on client and server spans', async () => {
        await httpRequest.get(
          `${protocol}://${hostname}:${serverPort}${pathname}`,
          {headers: {guid: 'user_guid'}}
        );
        const spans = memoryExporter.getFinishedSpans();
        const [incomingSpan, outgoingSpan] = spans;

        assert.strictEqual(
          incomingSpan.attributes['custom request hook attribute'],
          'request'
        );
        assert.strictEqual(
          incomingSpan.attributes['custom response hook attribute'],
          'response'
        );
        assert.strictEqual(
          incomingSpan.attributes['custom response hook attribute'],
          'response'
        );
        assert.strictEqual(
          incomingSpan.attributes['guid'],
          'user_guid'
        );
        assert.strictEqual(
          incomingSpan.attributes['span kind'],
          SpanKind.CLIENT
        );

        assert.strictEqual(
          outgoingSpan.attributes['custom request hook attribute'],
          'request'
        );
        assert.strictEqual(
          outgoingSpan.attributes['custom response hook attribute'],
          'response'
        );
        assert.strictEqual(
          outgoingSpan.attributes['guid'],
          'user_guid'
        );
        assert.strictEqual(
          outgoingSpan.attributes['span kind'],
          SpanKind.CLIENT
        );
      });

      it('should not set span as active in context for outgoing request', done => {
        assert.deepStrictEqual(trace.getSpan(context.active()), undefined);
        http.get(`${protocol}://${hostname}:${serverPort}/test`, res => {
          assert.deepStrictEqual(trace.getSpan(context.active()), undefined);

          res.on('data', () => {
            assert.deepStrictEqual(trace.getSpan(context.active()), undefined);
          });

          res.on('end', () => {
            assert.deepStrictEqual(trace.getSpan(context.active()), undefined);
            done();
          });
        });
      });
    });

    describe('with require parent span', () => {
      beforeEach(done => {
        memoryExporter.reset();
        instrumentation.setConfig({});
        instrumentation.enable();
        server = http.createServer((request, response) => {
          response.end('Test Server Response');
        });
        server.listen(serverPort, done);
      });

      afterEach(() => {
        server.close();
        instrumentation.disable();
      });

      it('should not trace without parent with options enabled (both client & server)', async () => {
        instrumentation.disable();
        instrumentation.setConfig({
          requireParentforIncomingSpans: true,
          requireParentforOutgoingSpans: true,
        });
        instrumentation.enable();
        const testPath = '/test/test';
        await httpRequest.get(
          `${protocol}://${hostname}:${serverPort}${testPath}`
        );
        const spans = memoryExporter.getFinishedSpans();
        assert.strictEqual(spans.length, 0);
      });

      it('should not trace without parent with options enabled (client only)', async () => {
        instrumentation.disable();
        instrumentation.setConfig({
          requireParentforOutgoingSpans: true,
        });
        instrumentation.enable();
        const testPath = '/test/test';
        const result = await httpRequest.get(
          `${protocol}://${hostname}:${serverPort}${testPath}`
        );
        assert(
          result.reqHeaders[DummyPropagation.TRACE_CONTEXT_KEY] !== undefined
        );
        assert(
          result.reqHeaders[DummyPropagation.SPAN_CONTEXT_KEY] !== undefined
        );
        const spans = memoryExporter.getFinishedSpans();
        assert.strictEqual(spans.length, 1);
        assert.strictEqual(
          spans.every(span => span.kind === SpanKind.SERVER),
          true
        );
      });

      it('should not trace without parent with options enabled (server only)', async () => {
        instrumentation.disable();
        instrumentation.setConfig({
          requireParentforIncomingSpans: true,
        });
        instrumentation.enable();
        const testPath = '/test/test';
        const result = await httpRequest.get(
          `${protocol}://${hostname}:${serverPort}${testPath}`
        );
        assert(
          result.reqHeaders[DummyPropagation.TRACE_CONTEXT_KEY] !== undefined
        );
        assert(
          result.reqHeaders[DummyPropagation.SPAN_CONTEXT_KEY] !== undefined
        );
        const spans = memoryExporter.getFinishedSpans();
        assert.strictEqual(spans.length, 1);
        assert.strictEqual(
          spans.every(span => span.kind === SpanKind.CLIENT),
          true
        );
      });

      it('should trace with parent with both requireParent options enabled', done => {
        instrumentation.disable();
        instrumentation.setConfig({
          requireParentforIncomingSpans: true,
          requireParentforOutgoingSpans: true,
        });
        instrumentation.enable();
        const testPath = '/test/test';
        const tracer = provider.getTracer('default');
        const span = tracer.startSpan('parentSpan', {
          kind: SpanKind.INTERNAL,
        });
        context.with(trace.setSpan(context.active(), span), () => {
          httpRequest
            .get(`${protocol}://${hostname}:${serverPort}${testPath}`)
            .then(result => {
              span.end();
              assert(
                result.reqHeaders[DummyPropagation.TRACE_CONTEXT_KEY] !==
                  undefined
              );
              assert(
                result.reqHeaders[DummyPropagation.SPAN_CONTEXT_KEY] !==
                  undefined
              );
              const spans = memoryExporter.getFinishedSpans();
              assert.strictEqual(spans.length, 2);
              assert.strictEqual(
                spans.filter(span => span.kind === SpanKind.CLIENT).length,
                1
              );
              assert.strictEqual(
                spans.filter(span => span.kind === SpanKind.INTERNAL).length,
                1
              );
              return done();
            })
            .catch(done);
        });
      });
    });
    describe('rpc metadata', () => {
      beforeEach(() => {
        memoryExporter.reset();
        instrumentation.setConfig({ requireParentforOutgoingSpans: true });
        instrumentation.enable();
      });

      afterEach(() => {
        server.close();
        instrumentation.disable();
      });

      it('should set rpc metadata for incoming http request', async () => {
        server = http.createServer((request, response) => {
          const rpcMemadata = getRPCMetadata(context.active());
          assert(typeof rpcMemadata !== 'undefined');
          assert(rpcMemadata.type === RPCType.HTTP);
          assert(rpcMemadata.span.setAttribute('key', 'value'));
          response.end('Test Server Response');
        });
        await new Promise<void>(resolve => server.listen(serverPort, resolve));
        await httpRequest.get(`${protocol}://${hostname}:${serverPort}`);
        const spans = memoryExporter.getFinishedSpans();
        assert.strictEqual(spans.length, 1);
        assert.strictEqual(spans[0].attributes.key, 'value');
      });
    });
  });
});
