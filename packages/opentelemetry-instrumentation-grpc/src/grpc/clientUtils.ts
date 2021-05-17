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
import type * as events from 'events';
import { SendUnaryDataCallback, GrpcClientFunc } from './types';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import {
  context,
  Span,
  SpanStatusCode,
  SpanKind,
  SpanStatus,
  propagation,
} from '@opentelemetry/api';
import {
  _grpcStatusCodeToSpanStatus,
  _grpcStatusCodeToOpenTelemetryStatusCode,
  findIndex,
} from '../utils';
import { AttributeNames } from '../enums/AttributeNames';

/**
 * This method handles the client remote call
 */
export const makeGrpcClientRemoteCall = function (
  grpcClient: typeof grpcTypes,
  original: GrpcClientFunc,
  args: any[],
  metadata: grpcTypes.Metadata,
  self: grpcTypes.Client
) {
  /**
   * Patches a callback so that the current span for this trace is also ended
   * when the callback is invoked.
   */
  function patchedCallback(
    span: Span,
    callback: SendUnaryDataCallback,
    _metadata: grpcTypes.Metadata
  ) {
    const wrappedFn = (err: grpcTypes.ServiceError, res: any) => {
      if (err) {
        if (err.code) {
          span.setStatus(_grpcStatusCodeToSpanStatus(err.code));
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

      span.end();
      callback(err, res);
    };
    return context.bind(wrappedFn);
  }

  return (span: Span) => {
    if (!span) {
      return original.apply(self, args);
    }

    // if unary or clientStream
    if (!original.responseStream) {
      const callbackFuncIndex = findIndex(args, arg => {
        return typeof arg === 'function';
      });
      if (callbackFuncIndex !== -1) {
        args[callbackFuncIndex] = patchedCallback(
          span,
          args[callbackFuncIndex],
          metadata
        );
      }
    }

    span.addEvent('sent');
    span.setAttributes({
      [AttributeNames.GRPC_METHOD]: original.path,
      [AttributeNames.GRPC_KIND]: SpanKind.CLIENT,
    });

    setSpanContext(metadata);
    const call = original.apply(self, args);

    // if server stream or bidi
    if (original.responseStream) {
      // Both error and status events can be emitted
      // the first one emitted set spanEnded to true
      let spanEnded = false;
      const endSpan = () => {
        if (!spanEnded) {
          span.end();
          spanEnded = true;
        }
      };
      context.bind(call);
      ((call as unknown) as events.EventEmitter).on(
        'error',
        (err: grpcTypes.ServiceError) => {
          span.setStatus({
            code: _grpcStatusCodeToOpenTelemetryStatusCode(err.code),
            message: err.message,
          });
          span.setAttributes({
            [AttributeNames.GRPC_ERROR_NAME]: err.name,
            [AttributeNames.GRPC_ERROR_MESSAGE]: err.message,
          });
          endSpan();
        }
      );

      ((call as unknown) as events.EventEmitter).on(
        'status',
        (status: SpanStatus) => {
          span.setStatus({ code: SpanStatusCode.UNSET });
          span.setAttribute(
            SemanticAttributes.RPC_GRPC_STATUS_CODE,
            status.code.toString()
          );
          endSpan();
        }
      );
    }
    return call;
  };
};

export const getMetadata = function (
  grpcClient: typeof grpcTypes,
  original: GrpcClientFunc,
  args: any[]
): grpcTypes.Metadata {
  let metadata: grpcTypes.Metadata;

  // This finds an instance of Metadata among the arguments.
  // A possible issue that could occur is if the 'options' parameter from
  // the user contains an '_internal_repr' as well as a 'getMap' function,
  // but this is an extremely rare case.
  let metadataIndex = findIndex(args, (arg: any) => {
    return (
      arg &&
      typeof arg === 'object' &&
      arg._internal_repr &&
      typeof arg.getMap === 'function'
    );
  });
  if (metadataIndex === -1) {
    metadata = new grpcClient.Metadata();
    if (!original.requestStream) {
      // unary or server stream
      if (args.length === 0) {
        // No argument (for the gRPC call) was provided, so we will have to
        // provide one, since metadata cannot be the first argument.
        // The internal representation of argument defaults to undefined
        // in its non-presence.
        // Note that we can't pass null instead of undefined because the
        // serializer within gRPC doesn't accept it.
        args.push(undefined);
      }
      metadataIndex = 1;
    } else {
      // client stream or bidi
      metadataIndex = 0;
    }
    args.splice(metadataIndex, 0, metadata);
  } else {
    metadata = args[metadataIndex];
  }
  return metadata;
};

const setSpanContext = function (metadata: grpcTypes.Metadata): void {
  propagation.inject(context.active(), metadata, {
    set: (metadata, k, v) => metadata.set(k, v as grpcTypes.MetadataValue),
  });
};
