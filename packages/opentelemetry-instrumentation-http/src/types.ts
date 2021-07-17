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
  Span,
  SpanAttributes,
 } from '@opentelemetry/api';
import type * as http from 'http';
import type * as https from 'https';
import {
  ClientRequest,
  get,
  IncomingMessage,
  request,
  ServerResponse,
  RequestOptions,
} from 'http';
import * as url from 'url';
import { InstrumentationConfig } from '@opentelemetry/instrumentation';

export type IgnoreMatcher = string | RegExp | ((url: string) => boolean);
export type HttpCallback = (res: IncomingMessage) => void;
export type RequestFunction = typeof request;
export type GetFunction = typeof get;

export type HttpCallbackOptional = HttpCallback | undefined;

// from node 10+
export type RequestSignature = [http.RequestOptions, HttpCallbackOptional] &
  HttpCallback;

export type HttpRequestArgs = Array<HttpCallbackOptional | RequestSignature>;

export type ParsedRequestOptions =
  | (http.RequestOptions & Partial<url.UrlWithParsedQuery>)
  | http.RequestOptions;
export type Http = typeof http;
export type Https = typeof https;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Func<T> = (...args: any[]) => T;
export type ResponseEndArgs =
  | [((() => void) | undefined)?]
  | [unknown, ((() => void) | undefined)?]
  | [unknown, string, ((() => void) | undefined)?];

export interface HttpCustomAttributeFunction {
  (
    span: Span,
    request: ClientRequest | IncomingMessage,
    response: IncomingMessage | ServerResponse
  ): void;
}

export interface HttpRequestCustomAttributeFunction {
  (span: Span, request: ClientRequest | IncomingMessage): void;
}

export interface HttpResponseCustomAttributeFunction {
  (span: Span, response: IncomingMessage | ServerResponse): void;
}

export interface StartIncomingSpanCustomAttributeFunction {
  (request: IncomingMessage ): SpanAttributes;
}

export interface StartOutgoingSpanCustomAttributeFunction {
  (request: RequestOptions ): SpanAttributes;
}

/**
 * Options available for the HTTP instrumentation (see [documentation](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-instrumentation-http#http-instrumentation-options))
 */
export interface HttpInstrumentationConfig extends InstrumentationConfig {
  /** Not trace all incoming requests that match paths */
  ignoreIncomingPaths?: IgnoreMatcher[];
  /** Not trace all outgoing requests that match urls */
  ignoreOutgoingUrls?: IgnoreMatcher[];
  /** Function for adding custom attributes after response is handled */
  applyCustomAttributesOnSpan?: HttpCustomAttributeFunction;
  /** Function for adding custom attributes before request is handled */
  requestHook?: HttpRequestCustomAttributeFunction;
  /** Function for adding custom attributes before response is handled */
  responseHook?: HttpResponseCustomAttributeFunction;
  /** Function for adding custom attributes before a span is started in incomingRequest */
  startIncomingSpanHook?: StartIncomingSpanCustomAttributeFunction;
  /** Function for adding custom attributes before a span is started in outgoingRequest */
  startOutgoingSpanHook?: StartOutgoingSpanCustomAttributeFunction;
  /** The primary server name of the matched virtual host. */
  serverName?: string;
  /** Require parent to create span for outgoing requests */
  requireParentforOutgoingSpans?: boolean;
  /** Require parent to create span for incoming requests */
  requireParentforIncomingSpans?: boolean;
}

export interface Err extends Error {
  errno?: number;
  code?: string;
  path?: string;
  syscall?: string;
  stack?: string;
}
