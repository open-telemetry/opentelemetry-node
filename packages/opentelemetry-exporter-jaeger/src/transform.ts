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

import { Link, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { ReadableSpan } from '@opentelemetry/tracing';
import {
  hrTimeToMilliseconds,
  hrTimeToMicroseconds,
} from '@opentelemetry/core';
import {
  ThriftSpan,
  Tag,
  Log,
  ThriftTag,
  ThriftLog,
  ThriftUtils,
  Utils,
  ThriftReference,
  TagValue,
  ThriftReferenceType,
} from './types';

const DEFAULT_FLAGS = 0x1;

/**
 * Translate OpenTelemetry ReadableSpan to Jaeger Thrift Span
 * @param span Span to be translated
 */
export function spanToThrift(span: ReadableSpan): ThriftSpan {
  const traceId = span.spanContext().traceId.padStart(32, '0');
  const traceIdHigh = traceId.slice(0, 16);
  const traceIdLow = traceId.slice(16);
  const parentSpan = span.parentSpanId
    ? Utils.encodeInt64(span.parentSpanId)
    : ThriftUtils.emptyBuffer;

  const tags = Object.keys(span.attributes).map(
    (name): Tag => ({ key: name, value: toTagValue(span.attributes[name]) })
  );
  if (span.status.code !== SpanStatusCode.UNSET) {
    tags.push({
      key: 'otel.status_code',
      value: SpanStatusCode[span.status.code],
    });
    if (span.status.message) {
      tags.push({ key: 'otel.status_description', value: span.status.message });
    }
  }
  // Ensure that if SpanStatus.Code is ERROR, that we set the "error" tag on the
  // Jaeger span.
  if (span.status.code === SpanStatusCode.ERROR) {
    tags.push({ key: 'error', value: true });
  }

  if (span.kind !== undefined && span.kind !== SpanKind.INTERNAL) {
    tags.push({ key: 'span.kind', value: SpanKind[span.kind].toLowerCase() });
  }
  Object.keys(span.resource.attributes).forEach(name =>
    tags.push({
      key: name,
      value: toTagValue(span.resource.attributes[name]),
    })
  );

  if (span.instrumentationLibrary) {
    tags.push({
      key: 'otel.library.name',
      value: toTagValue(span.instrumentationLibrary.name),
    });
    tags.push({
      key: 'otel.library.version',
      value: toTagValue(span.instrumentationLibrary.version),
    });
  }

  const spanTags: ThriftTag[] = ThriftUtils.getThriftTags(tags);

  const logs = span.events.map(
    (event): Log => {
      const fields: Tag[] = [{ key: 'event', value: event.name }];
      const attrs = event.attributes;
      if (attrs) {
        Object.keys(attrs).forEach(attr =>
          fields.push({ key: attr, value: toTagValue(attrs[attr]) })
        );
      }
      return { timestamp: hrTimeToMilliseconds(event.time), fields };
    }
  );
  const spanLogs: ThriftLog[] = ThriftUtils.getThriftLogs(logs);

  return {
    traceIdLow: Utils.encodeInt64(traceIdLow),
    traceIdHigh: Utils.encodeInt64(traceIdHigh),
    spanId: Utils.encodeInt64(span.spanContext().spanId),
    parentSpanId: parentSpan,
    operationName: span.name,
    references: spanLinksToThriftRefs(span.links, span.parentSpanId),
    flags: span.spanContext().traceFlags || DEFAULT_FLAGS,
    startTime: Utils.encodeInt64(hrTimeToMicroseconds(span.startTime)),
    duration: Utils.encodeInt64(hrTimeToMicroseconds(span.duration)),
    tags: spanTags,
    logs: spanLogs,
  };
}

/** Translate OpenTelemetry {@link Link}s to Jaeger ThriftReference. */
function spanLinksToThriftRefs(
  links: Link[],
  parentSpanId?: string
): ThriftReference[] {
  return links
    .map((link): ThriftReference | null => {
      if (link.context.spanId === parentSpanId) {
        const refType = ThriftReferenceType.FOLLOWS_FROM;
        const traceId = link.context.traceId;
        const traceIdHigh = Utils.encodeInt64(traceId.slice(0, 16));
        const traceIdLow = Utils.encodeInt64(traceId.slice(16));
        const spanId = Utils.encodeInt64(link.context.spanId);
        return { traceIdLow, traceIdHigh, spanId, refType };
      }
      return null;
    })
    .filter(ref => !!ref) as ThriftReference[];
}

/** Translate OpenTelemetry attribute value to Jaeger TagValue. */
function toTagValue(value: unknown): TagValue {
  const valueType = typeof value;
  if (valueType === 'boolean') {
    return value as boolean;
  } else if (valueType === 'number') {
    return value as number;
  }
  return String(value);
}
