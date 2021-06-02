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
  diag,
  INVALID_SPAN_CONTEXT,
  propagation,
  ROOT_CONTEXT,
  Span,
  SpanKind,
  SpanOptions,
  SpanStatus,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';
import type * as http from 'http';
import type * as https from 'https';
import { Socket } from 'net';
import * as semver from 'semver';
import * as url from 'url';
import {
  Err,
  Func,
  Http,
  HttpInstrumentationConfig,
  HttpRequestArgs,
  Https,
  ParsedRequestOptions,
  ResponseEndArgs,
} from './types';
import * as utils from './utils';
import { VERSION } from './version';
import {
  InstrumentationBase,
  InstrumentationConfig,
  InstrumentationNodeModuleDefinition,
  isWrapped,
  safeExecuteInTheMiddle,
} from '@opentelemetry/instrumentation';
import { RPCMetadata, RPCType, setRPCMetadata } from '@opentelemetry/core';

/**
 * Http instrumentation instrumentation for Opentelemetry
 */
export class HttpInstrumentation extends InstrumentationBase<Http> {
  /** keep track on spans not ended */
  private readonly _spanNotEnded: WeakSet<Span> = new WeakSet<Span>();
  private readonly _version = process.versions.node;

  constructor(config: HttpInstrumentationConfig & InstrumentationConfig = {}) {
    super(
      '@opentelemetry/instrumentation-http',
      VERSION,
      Object.assign({}, config)
    );
  }

  private _getConfig(): HttpInstrumentationConfig {
    return this._config;
  }

  override setConfig(config: HttpInstrumentationConfig & InstrumentationConfig = {}) {
    this._config = Object.assign({}, config);
  }

  init() {
    return [this._getHttpsInstrumentation(), this._getHttpInstrumentation()];
  }

  private _getHttpInstrumentation() {
    return new InstrumentationNodeModuleDefinition<Http>(
      'http',
      ['*'],
      moduleExports => {
        diag.debug(`Applying patch for http@${this._version}`);
        if (isWrapped(moduleExports.request)) {
          this._unwrap(moduleExports, 'request');
        }
        this._wrap(
          moduleExports,
          'request',
          this._getPatchOutgoingRequestFunction('http')
        );
        if (isWrapped(moduleExports.get)) {
          this._unwrap(moduleExports, 'get');
        }
        this._wrap(
          moduleExports,
          'get',
          this._getPatchOutgoingGetFunction(moduleExports.request)
        );
        if (isWrapped(moduleExports.Server.prototype.emit)) {
          this._unwrap(moduleExports.Server.prototype, 'emit');
        }
        this._wrap(
          moduleExports.Server.prototype,
          'emit',
          this._getPatchIncomingRequestFunction('http')
        );
        return moduleExports;
      },
      moduleExports => {
        if (moduleExports === undefined) return;
        diag.debug(`Removing patch for http@${this._version}`);

        this._unwrap(moduleExports, 'request');
        this._unwrap(moduleExports, 'get');
        this._unwrap(moduleExports.Server.prototype, 'emit');
      }
    );
  }

  private _getHttpsInstrumentation() {
    return new InstrumentationNodeModuleDefinition<Https>(
      'https',
      ['*'],
      moduleExports => {
        diag.debug(`Applying patch for https@${this._version}`);
        if (isWrapped(moduleExports.request)) {
          this._unwrap(moduleExports, 'request');
        }
        this._wrap(
          moduleExports,
          'request',
          this._getPatchHttpsOutgoingRequestFunction('https')
        );
        if (isWrapped(moduleExports.get)) {
          this._unwrap(moduleExports, 'get');
        }
        this._wrap(
          moduleExports,
          'get',
          this._getPatchHttpsOutgoingGetFunction(moduleExports.request)
        );
        if (isWrapped(moduleExports.Server.prototype.emit)) {
          this._unwrap(moduleExports.Server.prototype, 'emit');
        }
        this._wrap(
          moduleExports.Server.prototype,
          'emit',
          this._getPatchIncomingRequestFunction('https')
        );
        return moduleExports;
      },
      moduleExports => {
        if (moduleExports === undefined) return;
        diag.debug(`Removing patch for https@${this._version}`);

        this._unwrap(moduleExports, 'request');
        this._unwrap(moduleExports, 'get');
        this._unwrap(moduleExports.Server.prototype, 'emit');
      }
    );
  }

  /**
   * Creates spans for incoming requests, restoring spans' context if applied.
   */
  protected _getPatchIncomingRequestFunction(component: 'http' | 'https') {
    return (original: (event: string, ...args: unknown[]) => boolean) => {
      return this._incomingRequestFunction(component, original);
    };
  }

  /**
   * Creates spans for outgoing requests, sending spans' context for distributed
   * tracing.
   */
  protected _getPatchOutgoingRequestFunction(component: 'http' | 'https') {
    return (original: Func<http.ClientRequest>): Func<http.ClientRequest> => {
      return this._outgoingRequestFunction(component, original);
    };
  }

  protected _getPatchOutgoingGetFunction(
    clientRequest: (
      options: http.RequestOptions | string | url.URL,
      ...args: HttpRequestArgs
    ) => http.ClientRequest
  ) {
    return (_original: Func<http.ClientRequest>): Func<http.ClientRequest> => {
      // Re-implement http.get. This needs to be done (instead of using
      // getPatchOutgoingRequestFunction to patch it) because we need to
      // set the trace context header before the returned http.ClientRequest is
      // ended. The Node.js docs state that the only differences between
      // request and get are that (1) get defaults to the HTTP GET method and
      // (2) the returned request object is ended immediately. The former is
      // already true (at least in supported Node versions up to v10), so we
      // simply follow the latter. Ref:
      // https://nodejs.org/dist/latest/docs/api/http.html#http_http_get_options_callback
      // https://github.com/googleapis/cloud-trace-nodejs/blob/master/src/instrumentations/instrumentation-http.ts#L198
      return function outgoingGetRequest<
        T extends http.RequestOptions | string | url.URL
      >(options: T, ...args: HttpRequestArgs): http.ClientRequest {
        const req = clientRequest(options, ...args);
        req.end();
        return req;
      };
    };
  }

  /** Patches HTTPS outgoing requests */
  private _getPatchHttpsOutgoingRequestFunction(component: 'http' | 'https') {
    return (original: Func<http.ClientRequest>): Func<http.ClientRequest> => {
      const instrumentation = this;
      return function httpsOutgoingRequest(
        // eslint-disable-next-line node/no-unsupported-features/node-builtins
        options: https.RequestOptions | string | URL,
        ...args: HttpRequestArgs
      ): http.ClientRequest {
        // Makes sure options will have default HTTPS parameters
        if (
          component === 'https' &&
          typeof options === 'object' &&
          options?.constructor?.name !== 'URL'
        ) {
          options = Object.assign({}, options);
          instrumentation._setDefaultOptions(options);
        }
        return instrumentation._getPatchOutgoingRequestFunction(component)(
          original
        )(options, ...args);
      };
    };
  }

  private _setDefaultOptions(options: https.RequestOptions) {
    options.protocol = options.protocol || 'https:';
    options.port = options.port || 443;
  }

  /** Patches HTTPS outgoing get requests */
  private _getPatchHttpsOutgoingGetFunction(
    clientRequest: (
      // eslint-disable-next-line node/no-unsupported-features/node-builtins
      options: http.RequestOptions | string | URL,
      ...args: HttpRequestArgs
    ) => http.ClientRequest
  ) {
    return (original: Func<http.ClientRequest>): Func<http.ClientRequest> => {
      const instrumentation = this;
      return function httpsOutgoingRequest(
        // eslint-disable-next-line node/no-unsupported-features/node-builtins
        options: https.RequestOptions | string | URL,
        ...args: HttpRequestArgs
      ): http.ClientRequest {
        return instrumentation._getPatchOutgoingGetFunction(clientRequest)(
          original
        )(options, ...args);
      };
    };
  }

  /**
   * Attach event listeners to a client request to end span and add span attributes.
   *
   * @param request The original request object.
   * @param options The arguments to the original function.
   * @param span representing the current operation
   */
  private _traceClientRequest(
    component: 'http' | 'https',
    request: http.ClientRequest,
    options: ParsedRequestOptions,
    span: Span
  ): http.ClientRequest {
    const hostname =
      options.hostname ||
      options.host?.replace(/^(.*)(:[0-9]{1,5})/, '$1') ||
      'localhost';
    const attributes = utils.getOutgoingRequestAttributes(options, {
      component,
      hostname,
    });
    span.setAttributes(attributes);
    if (this._getConfig().requestHook) {
      this._callRequestHook(span, request);
    }

    /*
     * User 'response' event listeners can be added before our listener,
     * force our listener to be the first, so response emitter is bound
     * before any user listeners are added to it.
     */
    request.prependListener(
      'response',
      (response: http.IncomingMessage & { aborted?: boolean }) => {
        const responseAttributes = utils.getOutgoingRequestAttributesOnResponse(
          response,
          { hostname }
        );
        span.setAttributes(responseAttributes);
        if (this._getConfig().responseHook) {
          this._callResponseHook(span, response);
        }

        context.bind(response);
        diag.debug('outgoingRequest on response()');
        response.on('end', () => {
          diag.debug('outgoingRequest on end()');
          let status: SpanStatus;

          if (response.aborted && !response.complete) {
            status = { code: SpanStatusCode.ERROR };
          } else {
            status = utils.parseResponseStatus(response.statusCode!);
          }

          span.setStatus(status);

          if (this._getConfig().applyCustomAttributesOnSpan) {
            safeExecuteInTheMiddle(
              () =>
                this._getConfig().applyCustomAttributesOnSpan!(
                  span,
                  request,
                  response
                ),
              () => {},
              true
            );
          }

          this._closeHttpSpan(span);
        });
        response.on('error', (error: Err) => {
          utils.setSpanWithError(span, error, response);
          this._closeHttpSpan(span);
        });
      }
    );
    request.on('close', () => {
      if (!request.aborted) {
        this._closeHttpSpan(span);
      }
    });
    request.on('error', (error: Err) => {
      utils.setSpanWithError(span, error, request);
      this._closeHttpSpan(span);
    });

    diag.debug('http.ClientRequest return request');
    return request;
  }

  private _incomingRequestFunction(
    component: 'http' | 'https',
    original: (event: string, ...args: unknown[]) => boolean
  ) {
    const instrumentation = this;
    return function incomingRequest(
      this: {},
      event: string,
      ...args: unknown[]
    ): boolean {
      // Only traces request events
      if (event !== 'request') {
        return original.apply(this, [event, ...args]);
      }

      const request = args[0] as http.IncomingMessage;
      const response = args[1] as http.ServerResponse & { socket: Socket };
      const pathname = request.url
        ? url.parse(request.url).pathname || '/'
        : '/';
      const method = request.method || 'GET';

      diag.debug('%s instrumentation incomingRequest', component);

      if (
        utils.isIgnored(
          pathname,
          instrumentation._getConfig().ignoreIncomingPaths,
          (e: Error) => diag.error('caught ignoreIncomingPaths error: ', e)
        )
      ) {
        return context.with(suppressTracing(context.active()), () => {
          context.bind(request);
          context.bind(response);
          return original.apply(this, [event, ...args]);
        });
      }

      const headers = request.headers;

      const spanOptions: SpanOptions = {
        kind: SpanKind.SERVER,
        attributes: utils.getIncomingRequestAttributes(request, {
          component: component,
          serverName: instrumentation._getConfig().serverName,
        }),
      };

      const ctx = propagation.extract(ROOT_CONTEXT, headers);
      const span = instrumentation._startHttpSpan(
        `${component.toLocaleUpperCase()} ${method}`,
        spanOptions,
        ctx
      );
      const rpcMetadata: RPCMetadata = {
        type: RPCType.HTTP,
        span,
      };

      return context.with(
        setRPCMetadata(trace.setSpan(ctx, span), rpcMetadata),
        () => {
          context.bind(request);
          context.bind(response);

          if (instrumentation._getConfig().requestHook) {
            instrumentation._callRequestHook(span, request);
          }
          if (instrumentation._getConfig().responseHook) {
            instrumentation._callResponseHook(span, response);
          }

          // Wraps end (inspired by:
          // https://github.com/GoogleCloudPlatform/cloud-trace-nodejs/blob/master/src/instrumentations/instrumentation-connect.ts#L75)
          const originalEnd = response.end;
          response.end = function (
            this: http.ServerResponse,
            ..._args: ResponseEndArgs
          ) {
            response.end = originalEnd;
            // Cannot pass args of type ResponseEndArgs,
            const returned = safeExecuteInTheMiddle(
              () => response.end.apply(this, arguments as never),
              error => {
                if (error) {
                  utils.setSpanWithError(span, error);
                  instrumentation._closeHttpSpan(span);
                  throw error;
                }
              }
            );

            const attributes = utils.getIncomingRequestAttributesOnResponse(
              request,
              response
            );

            span
              .setAttributes(attributes)
              .setStatus(utils.parseResponseStatus(response.statusCode));

            if (instrumentation._getConfig().applyCustomAttributesOnSpan) {
              safeExecuteInTheMiddle(
                () =>
                  instrumentation._getConfig().applyCustomAttributesOnSpan!(
                    span,
                    request,
                    response
                  ),
                () => {},
                true
              );
            }

            instrumentation._closeHttpSpan(span);
            return returned;
          };

          return safeExecuteInTheMiddle(
            () => original.apply(this, [event, ...args]),
            error => {
              if (error) {
                utils.setSpanWithError(span, error);
                instrumentation._closeHttpSpan(span);
                throw error;
              }
            }
          );
        }
      );
    };
  }

  private _outgoingRequestFunction(
    component: 'http' | 'https',
    original: Func<http.ClientRequest>
  ): Func<http.ClientRequest> {
    const instrumentation = this;
    return function outgoingRequest(
      this: {},
      options: url.URL | http.RequestOptions | string,
      ...args: unknown[]
    ): http.ClientRequest {
      if (!utils.isValidOptionsType(options)) {
        return original.apply(this, [options, ...args]);
      }
      const extraOptions =
        typeof args[0] === 'object' &&
        (typeof options === 'string' || options instanceof url.URL)
          ? (args.shift() as http.RequestOptions)
          : undefined;
      const { origin, pathname, method, optionsParsed } = utils.getRequestInfo(
        options,
        extraOptions
      );
      /**
       * Node 8's https module directly call the http one so to avoid creating
       * 2 span for the same request we need to check that the protocol is correct
       * See: https://github.com/nodejs/node/blob/v8.17.0/lib/https.js#L245
       */
      if (
        component === 'http' &&
        semver.lt(process.version, '9.0.0') &&
        optionsParsed.protocol === 'https:'
      ) {
        return original.apply(this, [optionsParsed, ...args]);
      }

      if (
        utils.isIgnored(
          origin + pathname,
          instrumentation._getConfig().ignoreOutgoingUrls,
          (e: Error) => diag.error('caught ignoreOutgoingUrls error: ', e)
        )
      ) {
        return original.apply(this, [optionsParsed, ...args]);
      }

      const operationName = `${component.toUpperCase()} ${method}`;
      const spanOptions: SpanOptions = {
        kind: SpanKind.CLIENT,
      };
      const span = instrumentation._startHttpSpan(operationName, spanOptions);

      const parentContext = context.active();
      const requestContext = trace.setSpan(parentContext, span);

      if (!optionsParsed.headers) {
        optionsParsed.headers = {};
      }
      propagation.inject(requestContext, optionsParsed.headers);

      return context.with(requestContext, () => {
        /*
         * The response callback is registered before ClientRequest is bound,
         * thus it is needed to bind it before the function call.
         */
        const cb = args[args.length - 1];
        if (typeof cb === 'function') {
          args[args.length - 1] = context.bind(cb, parentContext);
        }

        const request: http.ClientRequest = safeExecuteInTheMiddle(
          () => original.apply(this, [optionsParsed, ...args]),
          error => {
            if (error) {
              utils.setSpanWithError(span, error);
              instrumentation._closeHttpSpan(span);
              throw error;
            }
          }
        );

        diag.debug('%s instrumentation outgoingRequest', component);
        context.bind(request, parentContext);
        return instrumentation._traceClientRequest(
          component,
          request,
          optionsParsed,
          span
        );
      });
    };
  }

  private _startHttpSpan(
    name: string,
    options: SpanOptions,
    ctx = context.active()
  ) {
    /*
     * If a parent is required but not present, we use a `NoopSpan` to still
     * propagate context without recording it.
     */
    const requireParent =
      options.kind === SpanKind.CLIENT
        ? this._getConfig().requireParentforOutgoingSpans
        : this._getConfig().requireParentforIncomingSpans;

    let span: Span;
    const currentSpan = trace.getSpan(ctx);

    if (requireParent === true && currentSpan === undefined) {
      span = trace.wrapSpanContext(INVALID_SPAN_CONTEXT);
    } else if (requireParent === true && currentSpan?.spanContext().isRemote) {
      span = currentSpan;
    } else {
      span = this.tracer.startSpan(name, options, ctx);
    }
    this._spanNotEnded.add(span);
    return span;
  }

  private _closeHttpSpan(span: Span) {
    if (!this._spanNotEnded.has(span)) {
      return;
    }

    span.end();
    this._spanNotEnded.delete(span);
  }

  private _callResponseHook(
    span: Span,
    response: http.IncomingMessage | http.ServerResponse
  ) {
    safeExecuteInTheMiddle(
      () => this._getConfig().responseHook!(span, response),
      () => {},
      true
    );
  }

  private _callRequestHook(
    span: Span,
    request: http.ClientRequest | http.IncomingMessage
  ) {
    safeExecuteInTheMiddle(
      () => this._getConfig().requestHook!(span, request),
      () => {},
      true
    );
  }
}
