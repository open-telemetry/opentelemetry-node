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

import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import * as assert from 'assert';
import type * as grpc from 'grpc';
import type * as grpcJs from '@grpc/grpc-js';
import { ReadableSpan } from '@opentelemetry/tracing';
import {
  hrTimeToMilliseconds,
  hrTimeToMicroseconds,
} from '@opentelemetry/core';

export const grpcStatusCodeToOpenTelemetryStatusCode = (
  status: grpc.status | grpcJs.status
): SpanStatusCode => {
  if (status !== undefined && status === 0) {
    return SpanStatusCode.UNSET;
  }
  return SpanStatusCode.ERROR;
};

export const assertSpan = (
  component: string,
  span: ReadableSpan,
  kind: SpanKind,
  validations: { name: string; status: grpc.status | grpcJs.status }
) => {
  assert.strictEqual(span.spanContext().traceId.length, 32);
  assert.strictEqual(span.spanContext().spanId.length, 16);
  assert.strictEqual(span.kind, kind);

  assert.ok(span.endTime);
  assert.strictEqual(span.links.length, 0);

  assert.ok(
    hrTimeToMicroseconds(span.startTime) < hrTimeToMicroseconds(span.endTime)
  );
  assert.ok(hrTimeToMilliseconds(span.endTime) > 0);

  if (span.kind === SpanKind.SERVER) {
    assert.ok(span.spanContext());
  }

  // validations
  assert.strictEqual(span.name, validations.name);
  assert.strictEqual(
    span.status.code,
    grpcStatusCodeToOpenTelemetryStatusCode(validations.status)
  );
};

// Check if sourceSpan was propagated to targetSpan
export const assertPropagation = (
  incomingSpan: ReadableSpan,
  outgoingSpan: ReadableSpan
) => {
  const targetSpanContext = incomingSpan.spanContext();
  const sourceSpanContext = outgoingSpan.spanContext();
  assert.strictEqual(targetSpanContext.traceId, sourceSpanContext.traceId);
  assert.strictEqual(incomingSpan.parentSpanId, sourceSpanContext.spanId);
  assert.strictEqual(
    targetSpanContext.traceFlags,
    sourceSpanContext.traceFlags
  );
  assert.notStrictEqual(targetSpanContext.spanId, sourceSpanContext.spanId);
};
