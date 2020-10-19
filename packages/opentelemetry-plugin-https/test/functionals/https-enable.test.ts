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
  CanonicalCode,
  context,
  propagation,
  Span as ISpan,
  SpanKind,
} from '@opentelemetry/api';
import { NoopLogger } from '@opentelemetry/core';
import { NodeTracerProvider } from '@opentelemetry/node';
import { Http, HttpPluginConfig } from '@opentelemetry/plugin-http';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { ContextManager } from '@opentelemetry/context-base';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/tracing';
import {
  GeneralAttribute,
  HttpAttribute,
} from '@opentelemetry/semantic-conventions';
import * as assert from 'assert';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as nock from 'nock';
import * as path from 'path';
import { HttpsPlugin, plugin } from '../../src/https';
import { assertSpan } from '../utils/assertSpan';
import { DummyPropagation } from '../utils/DummyPropagation';
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
const logger = new NoopLogger();
const provider = new NodeTracerProvider({
  logger,
});
const tracer = provider.getTracer('test-https');
provider.addSpanProcessor(new SimpleSpanProcessor(memoryExporter));
propagation.setGlobalPropagator(new DummyPropagation());

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

describe('HttpsPlugin', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new AsyncHooksContextManager().enable();
    context.setGlobalContextManager(contextManager);
  });

  afterEach(() => {
    contextManager.disable();
    context.disable();
  });

  it('should return a plugin', () => {
    assert.ok(plugin instanceof HttpsPlugin);
  });

  it('should match version', () => {
    assert.strictEqual(process.versions.node, plugin.version);
  });

  it(`moduleName should be ${protocol}`, () => {
    assert.strictEqual(protocol, plugin.moduleName);
  });

  describe('enable()', () => {
    describe('with bad plugin options', () => {
      let pluginWithBadOptions: HttpsPlugin;
      beforeEach(() => {
        memoryExporter.reset();
      });

      before(() => {
        const config: HttpPluginConfig = {
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
        pluginWithBadOptions = new HttpsPlugin(process.versions.node);
        pluginWithBadOptions.enable(
          (https as unknown) as Http,
          provider,
          tracer.logger,
          config
        );
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
        pluginWithBadOptions.disable();
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
          component: plugin.component,
        };

        assert.strictEqual(spans.length, 2);
        assertSpan(incomingSpan, SpanKind.SERVER, validations);
        assertSpan(outgoingSpan, SpanKind.CLIENT, validations);
        assert.strictEqual(
          incomingSpan.attributes[GeneralAttribute.NET_HOST_PORT],
          serverPort
        );
        assert.strictEqual(
          outgoingSpan.attributes[GeneralAttribute.NET_PEER_PORT],
          serverPort
        );
      });
    });
    describe('with good plugin options', () => {
      beforeEach(() => {
        memoryExporter.reset();
      });

      before(() => {
        const config: HttpPluginConfig = {
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
        };
        plugin.enable(
          (https as unknown) as Http,
          provider,
          tracer.logger,
          config
        );
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
        plugin.disable();
      });

      it(`${protocol} module should be patched`, () => {
        assert.strictEqual(https.Server.prototype.emit.__wrapped, true);
      });

      it(`should not patch if it's not a ${protocol} module`, () => {
        const httpsNotPatched = new HttpsPlugin(process.versions.node).enable(
          {} as Http,
          provider,
          tracer.logger,
          {}
        );
        assert.strictEqual(Object.keys(httpsNotPatched).length, 0);
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
          component: plugin.component,
          serverName,
        };

        assert.strictEqual(spans.length, 2);
        assert.strictEqual(
          incomingSpan.attributes[HttpAttribute.HTTP_CLIENT_IP],
          '<client>'
        );
        assert.strictEqual(
          incomingSpan.attributes[GeneralAttribute.NET_HOST_PORT],
          serverPort
        );
        assert.strictEqual(
          outgoingSpan.attributes[GeneralAttribute.NET_PEER_PORT],
          serverPort
        );

        [
          { span: incomingSpan, kind: SpanKind.SERVER },
          { span: outgoingSpan, kind: SpanKind.CLIENT },
        ].forEach(({ span, kind }) => {
          assert.strictEqual(span.attributes[HttpAttribute.HTTP_FLAVOR], '1.1');
          assert.strictEqual(
            span.attributes[GeneralAttribute.NET_TRANSPORT],
            GeneralAttribute.IP_TCP
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
            component: plugin.component,
          };

          assertSpan(reqSpan, SpanKind.CLIENT, validations);
        });
      }

      it('should create a child span for GET requests', async () => {
        const testPath = '/outgoing/rootSpan/childs/1';
        doNock(hostname, testPath, 200, 'Ok');
        const name = 'TestRootSpan';
        const span = tracer.startSpan(name);
        return tracer.withSpan(span, async () => {
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
            component: plugin.component,
          };

          assert.ok(localSpan.name.indexOf('TestRootSpan') >= 0);
          assert.strictEqual(spans.length, 2);
          assert.strictEqual(reqSpan.name, 'HTTP GET');
          assert.strictEqual(
            localSpan.spanContext.traceId,
            reqSpan.spanContext.traceId
          );
          assertSpan(reqSpan, SpanKind.CLIENT, validations);
          assert.notStrictEqual(
            localSpan.spanContext.spanId,
            reqSpan.spanContext.spanId
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
          return tracer.withSpan(span, async () => {
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
              component: plugin.component,
            };

            assert.ok(localSpan.name.indexOf('TestRootSpan') >= 0);
            assert.strictEqual(spans.length, 2);
            assert.strictEqual(reqSpan.name, 'HTTP GET');
            assert.strictEqual(
              localSpan.spanContext.traceId,
              reqSpan.spanContext.traceId
            );
            assertSpan(reqSpan, SpanKind.CLIENT, validations);
            assert.notStrictEqual(
              localSpan.spanContext.spanId,
              reqSpan.spanContext.spanId
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
        await tracer.withSpan(span, async () => {
          for (let i = 0; i < num; i++) {
            await httpsRequest.get(`${protocol}://${hostname}${testPath}`);
            const spans = memoryExporter.getFinishedSpans();
            assert.strictEqual(spans[i].name, 'HTTP GET');
            assert.strictEqual(
              span.context().traceId,
              spans[i].spanContext.traceId
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
        it(`should be tracable and not throw exception in ${protocol} plugin when passing the following argument ${JSON.stringify(
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
        it(`should not throw exception in https plugin when passing the following argument ${JSON.stringify(
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

      describe('when request is aborted', () => {
        describe('before the connection succeeds', () => {
          it('should have 1 ended span', async () => {
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
              assert.strictEqual(span.status.code, CanonicalCode.ABORTED);
              assert.ok(Object.keys(span.attributes).length >= 6);
            }
          });
        });

        describe('after the response is received', () => {
          let altServer: http.Server;
          const altServerPort = 22346;

          beforeEach(done => {
            altServer = https.createServer(
              {
                key: fs.readFileSync('test/fixtures/server-key.pem'),
                cert: fs.readFileSync('test/fixtures/server-cert.pem'),
              },
              (request, response) => {
                response.write('First part of the response');
                setTimeout(() => response.end(), 50);
              }
            );
            altServer.listen(altServerPort, done);
          });

          afterEach(() => {
            altServer.close();
          });

          it('should have 1 ended span', async () => {
            const promiseRequest = new Promise((resolve, reject) => {
              const req = https.request(
                `${protocol}://${hostname}:${altServerPort}`,
                (resp: http.IncomingMessage) => {
                  resp.on('data', data => {
                    req.abort();
                  });
                  resp.on('close', () => {
                    resolve();
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
              assert.strictEqual(span.status.code, CanonicalCode.ABORTED);
              assert.ok(Object.keys(span.attributes).length > 7);
            }
          });
        });
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
              span.attributes[HttpAttribute.HTTP_STATUS_CODE],
              404
            );
            assert.strictEqual(span.status.code, CanonicalCode.NOT_FOUND);
            done();
          });
        });
        req.end();
      });
    });
  });
});
