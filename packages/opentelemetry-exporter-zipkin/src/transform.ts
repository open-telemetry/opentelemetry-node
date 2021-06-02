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

import * as api from '@opentelemetry/api';
import { ReadableSpan, TimedEvent } from '@opentelemetry/tracing';
import { hrTimeToMicroseconds } from '@opentelemetry/core';
import * as zipkinTypes from './types';
import { Resource } from '@opentelemetry/resources';

const ZIPKIN_SPAN_KIND_MAPPING = {
  [api.SpanKind.CLIENT]: zipkinTypes.SpanKind.CLIENT,
  [api.SpanKind.SERVER]: zipkinTypes.SpanKind.SERVER,
  [api.SpanKind.CONSUMER]: zipkinTypes.SpanKind.CONSUMER,
  [api.SpanKind.PRODUCER]: zipkinTypes.SpanKind.PRODUCER,
  // When absent, the span is local.
  [api.SpanKind.INTERNAL]: undefined,
};

export const statusCodeTagName = 'ot.status_code';
export const statusDescriptionTagName = 'ot.status_description';

/**
 * Translate OpenTelemetry ReadableSpan to ZipkinSpan format
 * @param span Span to be translated
 */
export function toZipkinSpan(
  span: ReadableSpan,
  serviceName: string,
  statusCodeTagName: string,
  statusDescriptionTagName: string
): zipkinTypes.Span {
  const zipkinSpan: zipkinTypes.Span = {
    traceId: span.spanContext().traceId,
    parentId: span.parentSpanId,
    name: span.name,
    id: span.spanContext().spanId,
    kind: ZIPKIN_SPAN_KIND_MAPPING[span.kind],
    timestamp: hrTimeToMicroseconds(span.startTime),
    duration: hrTimeToMicroseconds(span.duration),
    localEndpoint: { serviceName },
    tags: _toZipkinTags(
      span.attributes,
      span.status,
      statusCodeTagName,
      statusDescriptionTagName,
      span.resource
    ),
    annotations: span.events.length
      ? _toZipkinAnnotations(span.events)
      : undefined,
  };

  return zipkinSpan;
}

/** Converts OpenTelemetry SpanAttributes and SpanStatus to Zipkin Tags format. */
export function _toZipkinTags(
  attributes: api.SpanAttributes,
  status: api.SpanStatus,
  statusCodeTagName: string,
  statusDescriptionTagName: string,
  resource: Resource
): zipkinTypes.Tags {
  const tags: { [key: string]: string } = {};
  for (const key of Object.keys(attributes)) {
    tags[key] = String(attributes[key]);
  }
  tags[statusCodeTagName] = String(api.SpanStatusCode[status.code]);
  if (status.message) {
    tags[statusDescriptionTagName] = status.message;
  }

  Object.keys(resource.attributes).forEach(
    name => (tags[name] = String(resource.attributes[name]))
  );

  return tags;
}

/**
 * Converts OpenTelemetry Events to Zipkin Annotations format.
 */
export function _toZipkinAnnotations(
  events: TimedEvent[]
): zipkinTypes.Annotation[] {
  return events.map(event => ({
    timestamp: hrTimeToMicroseconds(event.time),
    value: event.name,
  }));
}
