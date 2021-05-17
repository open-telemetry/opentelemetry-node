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

/**
 * Symbol to include on grpc call if it has already emitted an error event.
 * grpc events that emit 'error' will also emit 'finish' and so only the
 * error event should be processed.
 */

import { context, Span, SpanStatusCode } from '@opentelemetry/api';
import type * as grpcJs from '@grpc/grpc-js';
import type {
  ServerCallWithMeta,
  SendUnaryDataCallback,
  GrpcEmitter,
  HandleCall,
} from './types';
import {
  _grpcStatusCodeToOpenTelemetryStatusCode,
  _methodIsIgnored,
} from '../utils';
import { IgnoreMatcher } from '../types';
import { AttributeNames } from '../enums/AttributeNames';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';

export const CALL_SPAN_ENDED = Symbol('opentelemetry call span ended');

/**
 * Handle patching for serverStream and Bidi type server handlers
 */
function serverStreamAndBidiHandler<RequestType, ResponseType>(
  span: Span,
  call: GrpcEmitter,
  original:
    | grpcJs.handleBidiStreamingCall<RequestType, ResponseType>
    | grpcJs.handleServerStreamingCall<RequestType, ResponseType>
): void {
  let spanEnded = false;
  const endSpan = () => {
    if (!spanEnded) {
      spanEnded = true;
      span.end();
    }
  };

  context.bind(call);
  call.on('finish', () => {
    // @grpc/js does not expose a way to check if this call also emitted an error,
    // e.g. call.status.code !== 0
    if (call[CALL_SPAN_ENDED]) {
      return;
    }

    // Set the "grpc call had an error" flag
    call[CALL_SPAN_ENDED] = true;

    span.setStatus({
      code: SpanStatusCode.UNSET,
    });
    span.setAttribute(
      SemanticAttributes.RPC_GRPC_STATUS_CODE,
      SpanStatusCode.OK.toString()
    );

    endSpan();
  });

  call.on('error', (err: grpcJs.ServiceError) => {
    if (call[CALL_SPAN_ENDED]) {
      return;
    }

    // Set the "grpc call had an error" flag
    call[CALL_SPAN_ENDED] = true;

    span.setStatus({
      code: _grpcStatusCodeToOpenTelemetryStatusCode(err.code),
      message: err.message,
    });
    span.setAttributes({
      [AttributeNames.GRPC_ERROR_NAME]: err.name,
      [AttributeNames.GRPC_ERROR_MESSAGE]: err.message,
    });
    endSpan();
  });

  // Types of parameters 'call' and 'call' are incompatible.
  return (original as Function).call({}, call);
}

/**
 * Handle patching for clientStream and unary type server handlers
 */
function clientStreamAndUnaryHandler<RequestType, ResponseType>(
  span: Span,
  call: ServerCallWithMeta<RequestType, ResponseType>,
  callback: SendUnaryDataCallback<ResponseType>,
  original:
    | grpcJs.handleUnaryCall<RequestType, ResponseType>
    | grpcJs.ClientReadableStream<RequestType>
): void {
  const patchedCallback: SendUnaryDataCallback<ResponseType> = (
    err: grpcJs.ServiceError | null,
    value?: ResponseType
  ) => {
    if (err) {
      if (err.code) {
        span.setStatus({
          code: _grpcStatusCodeToOpenTelemetryStatusCode(err.code),
          message: err.message,
        });
        span.setAttribute(
          SemanticAttributes.RPC_GRPC_STATUS_CODE,
          err.code.toString()
        );
      }
      span.setAttributes({
        [AttributeNames.GRPC_ERROR_NAME]: err.name,
        [AttributeNames.GRPC_ERROR_MESSAGE]: err.message,
      });
    } else {
      span.setStatus({ code: SpanStatusCode.UNSET });
      span.setAttribute(
        SemanticAttributes.RPC_GRPC_STATUS_CODE,
        SpanStatusCode.OK.toString()
      );
    }

    span.end();
    return callback(err, value);
  };

  context.bind(call);
  return (original as Function).call({}, call, patchedCallback);
}

/**
 * Patch callback or EventEmitter provided by `originalFunc` and set appropriate `span`
 * properties based on its result.
 */
export function handleServerFunction<RequestType, ResponseType>(
  span: Span,
  type: string,
  originalFunc: HandleCall<RequestType, ResponseType>,
  call: ServerCallWithMeta<RequestType, ResponseType>,
  callback: SendUnaryDataCallback<unknown>
): void {
  switch (type) {
    case 'unary':
    case 'clientStream':
    case 'client_stream':
      return clientStreamAndUnaryHandler(
        span,
        call,
        callback,
        originalFunc as
          | grpcJs.handleUnaryCall<RequestType, ResponseType>
          | grpcJs.ClientReadableStream<RequestType>
      );
    case 'serverStream':
    case 'server_stream':
    case 'bidi':
      return serverStreamAndBidiHandler(
        span,
        call,
        originalFunc as
          | grpcJs.handleBidiStreamingCall<RequestType, ResponseType>
          | grpcJs.handleServerStreamingCall<RequestType, ResponseType>
      );
    default:
      break;
  }
}

/**
 * Does not patch any callbacks or EventEmitters to omit tracing on requests
 * that should not be traced.
 */
export function handleUntracedServerFunction<RequestType, ResponseType>(
  type: string,
  originalFunc: HandleCall<RequestType, ResponseType>,
  call: ServerCallWithMeta<RequestType, ResponseType>,
  callback: SendUnaryDataCallback<unknown>
): void {
  switch (type) {
    case 'unary':
    case 'clientStream':
    case 'client_stream':
      return (originalFunc as Function).call({}, call, callback);
    case 'serverStream':
    case 'server_stream':
    case 'bidi':
      return (originalFunc as Function).call({}, call);
    default:
      break;
  }
}

/**
 * Returns true if the server call should not be traced.
 */
export function shouldNotTraceServerCall(
  metadata: grpcJs.Metadata,
  methodName: string,
  ignoreGrpcMethods?: IgnoreMatcher[]
): boolean {
  const parsedName = methodName.split('/');
  return _methodIsIgnored(
    parsedName[parsedName.length - 1] || methodName,
    ignoreGrpcMethods
  );
}
