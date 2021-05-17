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
  context,
  SpanKind,
  propagation,
  setSpan,
  getSpan,
} from '@opentelemetry/api';
import { HttpTraceContextPropagator } from '@opentelemetry/core';
import { NodeTracerProvider } from '@opentelemetry/node';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { ContextManager } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/tracing';
import * as assert from 'assert';
import * as protoLoader from '@grpc/proto-loader';
import type * as grpcNapi from 'grpc';
import type * as grpcJs from '@grpc/grpc-js';
import { assertPropagation, assertSpan } from './utils/assertionUtils';
import { promisify } from 'util';
import type { GrpcInstrumentation } from '../src';
import * as path from 'path';

const PROTO_PATH = path.resolve(__dirname, './fixtures/grpc-test.proto');
const memoryExporter = new InMemorySpanExporter();

const options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

interface TestRequestResponse {
  num: number;
}

type ServiceError = grpcNapi.ServiceError | grpcJs.ServiceError;
type Client = grpcNapi.Client | grpcJs.Client;
type Server = grpcNapi.Server | grpcJs.Server;
type ServerUnaryCall =
  | grpcNapi.ServerUnaryCall<any>
  | grpcJs.ServerUnaryCall<any, any>;
type RequestCallback = grpcJs.requestCallback<any>;
type ServerReadableStream =
  | grpcNapi.ServerReadableStream<any>
  | grpcJs.ServerReadableStream<any, any>;
type ServerWriteableStream =
  | grpcNapi.ServerWriteableStream<any>
  | grpcJs.ServerWritableStream<any, any>;
type ServerDuplexStream =
  | grpcNapi.ServerDuplexStream<any, any>
  | grpcJs.ServerDuplexStream<any, any>;
type Metadata = grpcNapi.Metadata | grpcJs.Metadata;

type TestGrpcClient = (typeof grpcJs | typeof grpcNapi)['Client'] & {
  unaryMethod: any;
  UnaryMethod: any;
  camelCaseMethod: any;
  clientStreamMethod: any;
  serverStreamMethod: any;
  bidiStreamMethod: any;
};

interface TestGrpcCall {
  description: string;
  methodName: string;
  method: Function;
  request: TestRequestResponse | TestRequestResponse[];
  result: TestRequestResponse | TestRequestResponse[];
  metadata?: Metadata;
}

// Compare two arrays using an equal function f
const arrayIsEqual = (f: any) => ([x, ...xs]: any) => ([y, ...ys]: any): any =>
  x === undefined && y === undefined
    ? true
    : Boolean(f(x)(y)) && arrayIsEqual(f)(xs)(ys);

// Return true if two requests has the same num value
const requestEqual = (x: TestRequestResponse) => (y: TestRequestResponse) =>
  x.num !== undefined && x.num === y.num;

// Check if its equal requests or array of requests
const checkEqual = (x: TestRequestResponse | TestRequestResponse[]) => (
  y: TestRequestResponse | TestRequestResponse[]
) =>
  x instanceof Array && y instanceof Array
    ? arrayIsEqual(requestEqual)(x as any)(y as any)
    : !(x instanceof Array) && !(y instanceof Array)
    ? requestEqual(x)(y)
    : false;

export const runTests = (
  plugin: GrpcInstrumentation,
  moduleName: string,
  grpc: typeof grpcNapi | typeof grpcJs,
  grpcPort: number
) => {
  const MAX_ERROR_STATUS = grpc.status.UNAUTHENTICATED;

  const grpcClient = {
    unaryMethod: (
      client: TestGrpcClient,
      request: TestRequestResponse,
      metadata: Metadata = new grpc.Metadata()
    ): Promise<TestRequestResponse> => {
      return new Promise((resolve, reject) => {
        return client.unaryMethod(
          request,
          metadata,
          (err: ServiceError, response: TestRequestResponse) => {
            if (err) {
              reject(err);
            } else {
              resolve(response);
            }
          }
        );
      });
    },

    UnaryMethod: (
      client: TestGrpcClient,
      request: TestRequestResponse,
      metadata: Metadata = new grpc.Metadata()
    ): Promise<TestRequestResponse> => {
      return new Promise((resolve, reject) => {
        return client.UnaryMethod(
          request,
          metadata,
          (err: ServiceError, response: TestRequestResponse) => {
            if (err) {
              reject(err);
            } else {
              resolve(response);
            }
          }
        );
      });
    },

    camelCaseMethod: (
      client: TestGrpcClient,
      request: TestRequestResponse,
      metadata: Metadata = new grpc.Metadata()
    ): Promise<TestRequestResponse> => {
      return new Promise((resolve, reject) => {
        return client.camelCaseMethod(
          request,
          metadata,
          (err: ServiceError, response: TestRequestResponse) => {
            if (err) {
              reject(err);
            } else {
              resolve(response);
            }
          }
        );
      });
    },

    clientStreamMethod: (
      client: TestGrpcClient,
      request: TestRequestResponse[],
      metadata: Metadata = new grpc.Metadata()
    ): Promise<TestRequestResponse> => {
      return new Promise((resolve, reject) => {
        const writeStream = client.clientStreamMethod(
          metadata,
          (err: ServiceError, response: TestRequestResponse) => {
            if (err) {
              reject(err);
            } else {
              resolve(response);
            }
          }
        );

        request.forEach(element => {
          writeStream.write(element);
        });
        writeStream.end();
      });
    },

    serverStreamMethod: (
      client: TestGrpcClient,
      request: TestRequestResponse,
      metadata: Metadata = new grpc.Metadata()
    ): Promise<TestRequestResponse[]> => {
      return new Promise((resolve, reject) => {
        const result: TestRequestResponse[] = [];
        const readStream = client.serverStreamMethod(request, metadata);

        readStream.on('data', (data: TestRequestResponse) => {
          result.push(data);
        });
        readStream.on('error', (err: ServiceError) => {
          reject(err);
        });
        readStream.on('end', () => {
          resolve(result);
        });
      });
    },

    bidiStreamMethod: (
      client: TestGrpcClient,
      request: TestRequestResponse[],
      metadata: Metadata = new grpc.Metadata()
    ): Promise<TestRequestResponse[]> => {
      return new Promise((resolve, reject) => {
        const result: TestRequestResponse[] = [];
        const bidiStream = client.bidiStreamMethod(metadata);

        bidiStream.on('data', (data: TestRequestResponse) => {
          result.push(data);
        });

        request.forEach(element => {
          bidiStream.write(element);
        });

        bidiStream.on('error', (err: ServiceError) => {
          reject(err);
        });

        bidiStream.on('end', () => {
          resolve(result);
        });

        bidiStream.end();
      });
    },
  };

  let server: Server;
  let client: Client;

  const replicate = (request: TestRequestResponse) => {
    const result: TestRequestResponse[] = [];
    for (let i = 0; i < request.num; i++) {
      result.push(request);
    }
    return result;
  };

  async function startServer(
    grpc: typeof grpcJs | typeof grpcNapi,
    proto: any
  ) {
    const server = new grpc.Server();

    function getError(msg: string, code: number): ServiceError | null {
      const err: ServiceError = {
        ...new Error(msg),
        name: msg,
        message: msg,
        code,
        details: msg,
      };
      return err;
    }

    server.addService(proto.GrpcTester.service, {
      // An error is emitted every time
      // request.num <= MAX_ERROR_STATUS = (status.UNAUTHENTICATED)
      // in those cases, erro.code = request.num

      // This method returns the request
      unaryMethod(call: ServerUnaryCall, callback: RequestCallback) {
        call.request.num <= MAX_ERROR_STATUS
          ? callback(
              getError(
                'Unary Method Error',
                call.request.num
              ) as grpcJs.ServiceError
            )
          : callback(null, { num: call.request.num });
      },

      // This method returns the request
      camelCaseMethod(call: ServerUnaryCall, callback: RequestCallback) {
        call.request.num <= MAX_ERROR_STATUS
          ? callback(
              getError(
                'Unary Method Error',
                call.request.num
              ) as grpcJs.ServiceError
            )
          : callback(null, { num: call.request.num });
      },

      // This method sums the requests
      clientStreamMethod(
        call: ServerReadableStream,
        callback: RequestCallback
      ) {
        let sum = 0;
        let hasError = false;
        let code = grpc.status.OK;
        call.on('data', (data: TestRequestResponse) => {
          sum += data.num;
          if (data.num <= MAX_ERROR_STATUS) {
            hasError = true;
            code = data.num;
          }
        });
        call.on('end', () => {
          hasError
            ? callback(getError('Client Stream Method Error', code) as any)
            : callback(null, { num: sum });
        });
      },

      // This method returns an array that replicates the request, request.num of
      // times
      serverStreamMethod: (call: ServerWriteableStream) => {
        const result = replicate(call.request);

        if (call.request.num <= MAX_ERROR_STATUS) {
          call.emit(
            'error',
            getError('Server Stream Method Error', call.request.num)
          );
        } else {
          result.forEach(element => {
            call.write(element);
          });
        }
        call.end();
      },

      // This method returns the request
      bidiStreamMethod: (call: ServerDuplexStream) => {
        call.on('data', (data: TestRequestResponse) => {
          if (data.num <= MAX_ERROR_STATUS) {
            call.emit(
              'error',
              getError('Server Stream Method Error', data.num)
            );
          } else {
            call.write(data);
          }
        });
        call.on('end', () => {
          call.end();
        });
      },
    });
    const bindAwait = promisify(server.bindAsync);
    await bindAwait.call(
      server,
      'localhost:' + grpcPort,
      grpc.ServerCredentials.createInsecure() as grpcJs.ServerCredentials
    );
    server.start();
    return server;
  }

  function createClient(grpc: typeof grpcJs | typeof grpcNapi, proto: any) {
    return new proto.GrpcTester(
      'localhost:' + grpcPort,
      grpc.credentials.createInsecure()
    );
  }

  return describe('GrpcPlugin', () => {
    let contextManager: ContextManager;

    before(() => {
      propagation.setGlobalPropagator(new HttpTraceContextPropagator());
    });

    beforeEach(() => {
      contextManager = new AsyncHooksContextManager().enable();
      context.setGlobalContextManager(contextManager);
    });

    afterEach(() => {
      context.disable();
    });

    it('moduleName should be grpc', () => {
      assert.deepStrictEqual(
        '@opentelemetry/instrumentation-grpc',
        plugin.instrumentationName
      );
    });

    const requestList: TestRequestResponse[] = [{ num: 100 }, { num: 50 }];
    const resultSum = {
      num: requestList.reduce((sum, x) => {
        return sum + x.num;
      }, 0),
    };
    const methodList: TestGrpcCall[] = [
      {
        description: 'unary call',
        methodName: 'UnaryMethod',
        method: grpcClient.unaryMethod,
        request: requestList[0],
        result: requestList[0],
      },
      {
        description: 'Unary call',
        methodName: 'UnaryMethod',
        method: grpcClient.UnaryMethod,
        request: requestList[0],
        result: requestList[0],
      },
      {
        description: 'camelCase unary call',
        methodName: 'camelCaseMethod',
        method: grpcClient.camelCaseMethod,
        request: requestList[0],
        result: requestList[0],
      },
      {
        description: 'clientStream call',
        methodName: 'ClientStreamMethod',
        method: grpcClient.clientStreamMethod,
        request: requestList,
        result: resultSum,
      },
      {
        description: 'serverStream call',
        methodName: 'ServerStreamMethod',
        method: grpcClient.serverStreamMethod,
        request: resultSum,
        result: replicate(resultSum),
      },
      {
        description: 'bidiStream call',
        methodName: 'BidiStreamMethod',
        method: grpcClient.bidiStreamMethod,
        request: requestList,
        result: requestList,
      },
    ];

    const runTest = (
      method: typeof methodList[0],
      provider: NodeTracerProvider,
      checkSpans = true
    ) => {
      it(`should ${
        checkSpans ? 'do' : 'not'
      }: create a rootSpan for client and a childSpan for server - ${
        method.description
      }`, async () => {
        const args = [client, method.request, method.metadata];
        await (method.method as any)
          .apply({}, args)
          .then((result: TestRequestResponse | TestRequestResponse[]) => {
            assert.ok(
              checkEqual(result)(method.result),
              'gRPC call returns correct values'
            );
            const spans = memoryExporter.getFinishedSpans();
            if (checkSpans) {
              const incomingSpan = spans[0];
              const outgoingSpan = spans[1];
              const validations = {
                name: `grpc.pkg_test.GrpcTester/${method.methodName}`,
                status: grpc.status.OK,
              };

              assert.strictEqual(spans.length, 2);
              assertSpan(
                moduleName,
                incomingSpan,
                SpanKind.SERVER,
                validations
              );
              assertSpan(
                moduleName,
                outgoingSpan,
                SpanKind.CLIENT,
                validations
              );
              assertPropagation(incomingSpan, outgoingSpan);
            } else {
              assert.strictEqual(spans.length, 0);
            }
          });
      });

      it(`should raise an error for client childSpan/server rootSpan - ${method.description} - status = OK`, () => {
        const expectEmpty = memoryExporter.getFinishedSpans();
        assert.strictEqual(expectEmpty.length, 0);

        const span = provider
          .getTracer('default')
          .startSpan('TestSpan', { kind: SpanKind.PRODUCER });
        return context.with(setSpan(context.active(), span), async () => {
          const rootSpan = getSpan(context.active());
          if (!rootSpan) {
            return assert.ok(false);
          }
          assert.deepStrictEqual(rootSpan, span);

          const args = [client, method.request, method.metadata];
          await (method.method as any)
            .apply({}, args)
            .then(() => {
              // Assert
              if (checkSpans) {
                const spans = memoryExporter.getFinishedSpans();
                assert.strictEqual(spans.length, 2);
                const serverSpan = spans[0];
                const clientSpan = spans[1];
                const validations = {
                  name: `grpc.pkg_test.GrpcTester/${method.methodName}`,
                  status: grpc.status.OK,
                };
                assertSpan(
                  moduleName,
                  serverSpan,
                  SpanKind.SERVER,
                  validations
                );
                assertSpan(
                  moduleName,
                  clientSpan,
                  SpanKind.CLIENT,
                  validations
                );
                assertPropagation(serverSpan, clientSpan);
                assert.strictEqual(
                  rootSpan.context().traceId,
                  serverSpan.spanContext.traceId
                );
                assert.strictEqual(
                  rootSpan.context().spanId,
                  clientSpan.parentSpanId
                );
              }
            })
            .catch((err: ServiceError) => {
              assert.ok(false, err);
            });
        });
      });
    };

    const insertError = (
      request: TestRequestResponse | TestRequestResponse[]
    ) => (code: number) =>
      request instanceof Array ? [{ num: code }, ...request] : { num: code };

    const runErrorTest = (
      method: typeof methodList[0],
      key: string,
      errorCode: number,
      provider: NodeTracerProvider
    ) => {
      it(`should raise an error for client/server rootSpans: method=${method.methodName}, status=${key}`, async () => {
        const expectEmpty = memoryExporter.getFinishedSpans();
        assert.strictEqual(expectEmpty.length, 0);

        const args = [client, insertError(method.request)(errorCode)];

        await (method.method as any)
          .apply({}, args)
          .then(() => {
            assert.ok(false);
          })
          .catch((err: ServiceError) => {
            const spans = memoryExporter.getFinishedSpans();
            assert.strictEqual(spans.length, 2, 'Expect 2 ended spans');

            const validations = {
              name: `grpc.pkg_test.GrpcTester/${method.methodName}`,
              status: errorCode,
            };
            const serverRoot = spans[0];
            const clientRoot = spans[1];
            assertSpan(moduleName, serverRoot, SpanKind.SERVER, validations);
            assertSpan(moduleName, clientRoot, SpanKind.CLIENT, validations);
            assertPropagation(serverRoot, clientRoot);
          });
      });

      it(`should raise an error for client childSpan/server rootSpan - ${method.description} - status = ${key}`, () => {
        const expectEmpty = memoryExporter.getFinishedSpans();
        assert.strictEqual(expectEmpty.length, 0);

        const span = provider
          .getTracer('default')
          .startSpan('TestSpan', { kind: SpanKind.PRODUCER });
        return context.with(setSpan(context.active(), span), async () => {
          const rootSpan = getSpan(context.active());
          if (!rootSpan) {
            return assert.ok(false);
          }
          assert.deepStrictEqual(rootSpan, span);

          const args = [client, insertError(method.request)(errorCode)];

          await (method.method as any)
            .apply({}, args)
            .then(() => {
              assert.ok(false);
            })
            .catch((err: ServiceError) => {
              // Assert
              const spans = memoryExporter.getFinishedSpans();
              assert.strictEqual(spans.length, 2);
              const serverSpan = spans[0];
              const clientSpan = spans[1];
              const validations = {
                name: `grpc.pkg_test.GrpcTester/${method.methodName}`,
                status: errorCode,
              };
              assertSpan(moduleName, serverSpan, SpanKind.SERVER, validations);
              assertSpan(moduleName, clientSpan, SpanKind.CLIENT, validations);
              assertPropagation(serverSpan, clientSpan);
              assert.strictEqual(
                rootSpan.context().traceId,
                serverSpan.spanContext.traceId
              );
              assert.strictEqual(
                rootSpan.context().spanId,
                clientSpan.parentSpanId
              );
            });
        });
      });
    };

    describe('enable()', () => {
      const provider = new NodeTracerProvider();
      provider.addSpanProcessor(new SimpleSpanProcessor(memoryExporter));
      beforeEach(() => {
        memoryExporter.reset();
      });

      before(async () => {
        plugin.setTracerProvider(provider);
        plugin.enable();

        const packageDefinition = await protoLoader.load(PROTO_PATH, options);
        const proto = grpc.loadPackageDefinition(packageDefinition).pkg_test;

        server = await startServer(grpc, proto);
        client = createClient(grpc, proto);
      });

      after(done => {
        client.close();
        server.tryShutdown(() => {
          plugin.disable();
          done();
        });
      });

      methodList.forEach(method => {
        describe(`Test automatic tracing for grpc remote method ${method.description}`, () => {
          runTest(method, provider);
        });
      });

      methodList.forEach(method => {
        describe(`Test error raising for grpc remote ${method.description}`, () => {
          Object.keys(grpc.status).forEach((statusKey: string) => {
            const errorCode = Number(grpc.status[statusKey as any]);
            if (errorCode > grpc.status.OK) {
              runErrorTest(method, statusKey, errorCode, provider);
            }
          });
        });
      });
    });

    describe('disable()', () => {
      const provider = new NodeTracerProvider();
      provider.addSpanProcessor(new SimpleSpanProcessor(memoryExporter));
      beforeEach(() => {
        memoryExporter.reset();
      });

      before(async () => {
        plugin.disable();

        const packageDefinition = await protoLoader.load(PROTO_PATH, options);
        const proto = grpc.loadPackageDefinition(packageDefinition).pkg_test;

        server = await startServer(grpc, proto);
        client = createClient(grpc, proto);
      });

      after(done => {
        client.close();
        server.tryShutdown(() => {
          done();
        });
      });

      methodList.map(method => {
        describe(`Test automatic tracing for grpc remote method ${method.description}`, () => {
          runTest(method, provider, false);
        });
      });
    });

    describe('Test filtering requests using metadata', () => {
      const provider = new NodeTracerProvider();
      provider.addSpanProcessor(new SimpleSpanProcessor(memoryExporter));
      beforeEach(() => {
        memoryExporter.reset();
      });

      before(async () => {
        plugin.disable();
        plugin.setTracerProvider(provider);
        plugin.setConfig({});
        plugin.enable();

        const packageDefinition = await protoLoader.load(PROTO_PATH, options);
        const proto = grpc.loadPackageDefinition(packageDefinition).pkg_test;

        server = await startServer(grpc, proto);
        client = createClient(grpc, proto);
      });

      after(done => {
        client.close();
        server.tryShutdown(() => {
          plugin.disable();
          done();
        });
      });
    });

    describe('Test filtering requests using options', () => {
      const provider = new NodeTracerProvider();
      const checkSpans: { [key: string]: boolean } = {
        unaryMethod: false,
        UnaryMethod: false,
        camelCaseMethod: false,
        ClientStreamMethod: true,
        ServerStreamMethod: true,
        BidiStreamMethod: false,
      };
      provider.addSpanProcessor(new SimpleSpanProcessor(memoryExporter));
      beforeEach(() => {
        memoryExporter.reset();
      });

      before(async () => {
        const config = {
          ignoreGrpcMethods: [
            'UnaryMethod',
            new RegExp(/^camel.*Method$/),
            (str: string) => str === 'BidiStreamMethod',
          ],
        };
        plugin.disable();
        plugin.setConfig(config);
        plugin.setTracerProvider(provider);
        plugin.enable();

        const packageDefinition = await protoLoader.load(PROTO_PATH, options);
        const proto = grpc.loadPackageDefinition(packageDefinition).pkg_test;

        server = await startServer(grpc, proto);
        client = createClient(grpc, proto);
      });

      after(done => {
        client.close();
        server.tryShutdown(() => {
          plugin.disable();
          done();
        });
      });

      methodList.map(method => {
        describe(`Test should ${
          checkSpans[method.methodName] ? '' : 'not '
        }create spans for grpc remote method ${method.methodName}`, () => {
          runTest(method, provider, checkSpans[method.methodName]);
        });
      });
    });
  });
};
