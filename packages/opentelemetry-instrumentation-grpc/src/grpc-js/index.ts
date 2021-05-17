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

import type * as grpcJs from '@grpc/grpc-js';
import {
  InstrumentationNodeModuleDefinition,
  isWrapped,
} from '@opentelemetry/instrumentation';
import {
  InstrumentationBase,
  InstrumentationConfig,
} from '@opentelemetry/instrumentation';
import { GrpcInstrumentationConfig } from '../types';
import {
  ServerCallWithMeta,
  SendUnaryDataCallback,
  ServerRegisterFunction,
  HandleCall,
  MakeClientConstructorFunction,
  PackageDefinition,
  GrpcClientFunc,
} from './types';
import {
  context,
  SpanOptions,
  SpanKind,
  propagation,
  ROOT_CONTEXT,
  setSpan,
  diag,
} from '@opentelemetry/api';
import {
  shouldNotTraceServerCall,
  handleServerFunction,
  handleUntracedServerFunction,
} from './serverUtils';
import {
  getMethodsToWrap,
  makeGrpcClientRemoteCall,
  getMetadata,
} from './clientUtils';
import { EventEmitter } from 'events';
import { AttributeNames } from '../enums/AttributeNames';

export class GrpcJsInstrumentation extends InstrumentationBase {
  constructor(
    protected _config: GrpcInstrumentationConfig & InstrumentationConfig = {},
    name: string,
    version: string
  ) {
    super(name, version, _config);
  }

  public setConfig(
    config: GrpcInstrumentationConfig & InstrumentationConfig = {}
  ) {
    this._config = Object.assign({}, config);
  }

  init() {
    return [
      new InstrumentationNodeModuleDefinition<typeof grpcJs>(
        '@grpc/grpc-js',
        ['1.*'],
        (moduleExports, version) => {
          diag.debug(`Applying patch for @grpc/grpc-js@${version}`);
          if (isWrapped(moduleExports.Server.prototype.register)) {
            this._unwrap(moduleExports.Server.prototype, 'register');
          }
          // Patch Server methods
          this._wrap(
            moduleExports.Server.prototype,
            'register',
            this._patchServer() as any
          );
          // Patch Client methods
          if (isWrapped(moduleExports.makeGenericClientConstructor)) {
            this._unwrap(moduleExports, 'makeGenericClientConstructor');
          }
          this._wrap(
            moduleExports,
            'makeGenericClientConstructor',
            this._patchClient(moduleExports)
          );
          if (isWrapped(moduleExports.makeClientConstructor)) {
            this._unwrap(moduleExports, 'makeClientConstructor');
          }
          this._wrap(
            moduleExports,
            'makeClientConstructor',
            this._patchClient(moduleExports)
          );
          if (isWrapped(moduleExports.loadPackageDefinition)) {
            this._unwrap(moduleExports, 'loadPackageDefinition');
          }
          this._wrap(
            moduleExports,
            'loadPackageDefinition',
            this._patchLoadPackageDefinition(moduleExports)
          );
          return moduleExports;
        },
        (moduleExports, version) => {
          if (moduleExports === undefined) return;
          diag.debug(`Removing patch for @grpc/grpc-js@${version}`);

          this._unwrap(moduleExports.Server.prototype, 'register');
          this._unwrap(moduleExports, 'makeClientConstructor');
          this._unwrap(moduleExports, 'makeGenericClientConstructor');
          this._unwrap(moduleExports, 'loadPackageDefinition');
        }
      ),
    ];
  }

  /**
   * Patch for grpc.Server.prototype.register(...) function. Provides auto-instrumentation for
   * client_stream, server_stream, bidi, unary server handler calls.
   */
  private _patchServer(): (
    originalRegister: ServerRegisterFunction
  ) => ServerRegisterFunction {
    const instrumentation = this;
    return (originalRegister: ServerRegisterFunction) => {
      const config = this._config;
      diag.debug('patched gRPC server');
      return function register<RequestType, ResponseType>(
        this: grpcJs.Server,
        name: string,
        handler: HandleCall<unknown, unknown>,
        serialize: grpcJs.serialize<unknown>,
        deserialize: grpcJs.deserialize<unknown>,
        type: string
      ): boolean {
        const originalRegisterResult = originalRegister.call(
          this,
          name,
          handler,
          serialize,
          deserialize,
          type
        );
        const handlerSet = this['handlers'].get(name);

        instrumentation._wrap(
          handlerSet,
          'func',
          (originalFunc: HandleCall<unknown, unknown>) => {
            return function func(
              this: typeof handlerSet,
              call: ServerCallWithMeta<RequestType, ResponseType>,
              callback: SendUnaryDataCallback<unknown>
            ) {
              const self = this;

              if (
                shouldNotTraceServerCall(
                  call.metadata,
                  name,
                  config.ignoreGrpcMethods
                )
              ) {
                return handleUntracedServerFunction(
                  type,
                  originalFunc,
                  call,
                  callback
                );
              }

              const spanName = `grpc.${name.replace('/', '')}`;
              const spanOptions: SpanOptions = {
                kind: SpanKind.SERVER,
              };

              diag.debug('patch func: %s', JSON.stringify(spanOptions));

              context.with(
                propagation.extract(ROOT_CONTEXT, call.metadata, {
                  get: (carrier, key) => carrier.get(key).map(String),
                  keys: carrier => Object.keys(carrier.getMap()),
                }),
                () => {
                  const span = instrumentation.tracer
                    .startSpan(spanName, spanOptions)
                    .setAttributes({
                      [AttributeNames.GRPC_KIND]: spanOptions.kind,
                    });

                  context.with(setSpan(context.active(), span), () => {
                    handleServerFunction.call(
                      self,
                      span,
                      type,
                      originalFunc,
                      call,
                      callback
                    );
                  });
                }
              );
            };
          }
        );
        return originalRegisterResult;
      } as typeof grpcJs.Server.prototype.register;
    };
  }

  /**
   * Entry point for applying client patches to `grpc.makeClientConstructor(...)` equivalents
   * @param this GrpcJsPlugin
   */
  private _patchClient(
    grpcClient: typeof grpcJs
  ): (
    original: MakeClientConstructorFunction
  ) => MakeClientConstructorFunction {
    const instrumentation = this;
    return (original: MakeClientConstructorFunction) => {
      diag.debug('patching client');
      return function makeClientConstructor(
        this: typeof grpcJs.Client,
        methods: grpcJs.ServiceDefinition,
        serviceName: string,
        options?: object
      ) {
        const client = original.call(this, methods, serviceName, options);
        instrumentation._massWrap<typeof client.prototype, string>(
          client.prototype,
          getMethodsToWrap.call(instrumentation, client, methods),
          instrumentation._getPatchedClientMethods(grpcClient)
        );
        return client;
      };
    };
  }

  /**
   * Entry point for client patching for grpc.loadPackageDefinition(...)
   * @param this - GrpcJsPlugin
   */
  private _patchLoadPackageDefinition(grpcClient: typeof grpcJs) {
    const instrumentation = this;
    diag.debug('patching loadPackageDefinition');
    return (original: typeof grpcJs.loadPackageDefinition) => {
      return function patchedLoadPackageDefinition(
        this: null,
        packageDef: PackageDefinition
      ) {
        const result: grpcJs.GrpcObject = original.call(
          this,
          packageDef
        ) as grpcJs.GrpcObject;
        instrumentation._patchLoadedPackage(grpcClient, result);
        return result;
      } as typeof grpcJs.loadPackageDefinition;
    };
  }

  /**
   * Parse initial client call properties and start a span to trace its execution
   */
  private _getPatchedClientMethods(
    grpcClient: typeof grpcJs
  ): (original: GrpcClientFunc) => () => EventEmitter {
    const instrumentation = this;
    return (original: GrpcClientFunc) => {
      diag.debug('patch all client methods');
      return function clientMethodTrace(this: grpcJs.Client) {
        const name = `grpc.${original.path.replace('/', '')}`;
        const args = [...arguments];
        const metadata = getMetadata.call(
          instrumentation,
          grpcClient,
          original,
          args
        );
        const span = instrumentation.tracer.startSpan(name, {
          kind: SpanKind.CLIENT,
        });
        return context.with(setSpan(context.active(), span), () =>
          makeGrpcClientRemoteCall(original, args, metadata, this)(span)
        );
      };
    };
  }

  /**
   * Utility function to patch *all* functions loaded through a proto file.
   * Recursively searches for Client classes and patches all methods, reversing the
   * parsing done by grpc.loadPackageDefinition
   * https://github.com/grpc/grpc-node/blob/1d14203c382509c3f36132bd0244c99792cb6601/packages/grpc-js/src/make-client.ts#L200-L217
   */
  private _patchLoadedPackage(
    grpcClient: typeof grpcJs,
    result: grpcJs.GrpcObject
  ): void {
    Object.values(result).forEach(service => {
      if (typeof service === 'function') {
        this._massWrap<typeof service.prototype, string>(
          service.prototype,
          getMethodsToWrap.call(this, service, service.service),
          this._getPatchedClientMethods.call(this, grpcClient)
        );
      } else if (typeof service.format !== 'string') {
        // GrpcObject
        this._patchLoadedPackage.call(
          this,
          grpcClient,
          service as grpcJs.GrpcObject
        );
      }
    });
  }
}
