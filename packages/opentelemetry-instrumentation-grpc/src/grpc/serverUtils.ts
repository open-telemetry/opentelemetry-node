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

import type * as grpcTypes from 'grpc';
import { SendUnaryDataCallback, ServerCallWithMeta } from './types';
import { GrpcNativeInstrumentation } from './';
import { context, Span, SpanStatusCode } from '@opentelemetry/api';
import {
  _grpcStatusCodeToOpenTelemetryStatusCode,
  _grpcStatusCodeToSpanStatus,
  _methodIsIgnored,
} from '../utils';
import { AttributeNames } from '../enums/AttributeNames';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';

export const clientStreamAndUnaryHandler = function <RequestType, ResponseType>(
  grpcClient: typeof grpcTypes,
  span: Span,
  call: ServerCallWithMeta,
  callback: SendUnaryDataCallback,
  original:
    | grpcTypes.handleCall<RequestType, ResponseType>
    | grpcTypes.ClientReadableStream<RequestType>,
  self: {}
) {
  function patchedCallback(
    err: grpcTypes.ServiceError,
    value: any,
    trailer: grpcTypes.Metadata,
    flags: grpcTypes.writeFlags
  ) {
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
        grpcClient.status.OK.toString()
      );
    }
    span.addEvent('received');

    // end the span
    span.end();
    return callback(err, value, trailer, flags);
  }

  context.bind(call);
  return (original as Function).call(self, call, patchedCallback);
};

export const serverStreamAndBidiHandler = function <RequestType, ResponseType>(
  span: Span,
  call: ServerCallWithMeta,
  original: grpcTypes.handleCall<RequestType, ResponseType>,
  self: {}
) {
  let spanEnded = false;
  const endSpan = () => {
    if (!spanEnded) {
      spanEnded = true;
      span.end();
    }
  };

  context.bind(call);
  call.on('finish', () => {
    span.setStatus(_grpcStatusCodeToSpanStatus(call.status.code));
    span.setAttribute(
      SemanticAttributes.RPC_GRPC_STATUS_CODE,
      call.status.code.toString()
    );

    // if there is an error, span will be ended on error event, otherwise end it here
    if (call.status.code === 0) {
      span.addEvent('finished');
      endSpan();
    }
  });

  call.on('error', (err: grpcTypes.ServiceError) => {
    span.setStatus({
      code: _grpcStatusCodeToOpenTelemetryStatusCode(err.code),
      message: err.message,
    });
    span.addEvent('finished with error');
    span.setAttributes({
      [AttributeNames.GRPC_ERROR_NAME]: err.name,
      [AttributeNames.GRPC_ERROR_MESSAGE]: err.message,
    });
    endSpan();
  });

  return (original as any).call(self, call);
};

/**
 * Returns true if the server call should not be traced.
 */
export const shouldNotTraceServerCall = function (
  this: GrpcNativeInstrumentation,
  call: ServerCallWithMeta,
  name: string
): boolean {
  const parsedName = name.split('/');
  return _methodIsIgnored(
    parsedName[parsedName.length - 1] || name,
    this._config.ignoreGrpcMethods
  );
};
