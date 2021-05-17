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
  SpanAttributes,
  Link,
  SpanKind,
  SpanStatus,
  TraceState,
} from '@opentelemetry/api';
import * as core from '@opentelemetry/core';
import { Resource } from '@opentelemetry/resources';
import { ReadableSpan, TimedEvent } from '@opentelemetry/tracing';
import { CollectorExporterBase } from './CollectorExporterBase';
import {
  COLLECTOR_SPAN_KIND_MAPPING,
  opentelemetryProto,
  CollectorExporterConfigBase,
} from './types';

const MAX_INTEGER_VALUE = 2147483647;
const MIN_INTEGER_VALUE = -2147483648;

/**
 * Converts attributes to KeyValue array
 * @param attributes
 */
export function toCollectorAttributes(
  attributes: SpanAttributes
): opentelemetryProto.common.v1.KeyValue[] {
  return Object.keys(attributes).map(key => {
    return toCollectorAttributeKeyValue(key, attributes[key]);
  });
}

/**
 * Converts array of unknown value to ArrayValue
 * @param values
 */
export function toCollectorArrayValue(
  values: unknown[]
): opentelemetryProto.common.v1.ArrayValue {
  return {
    values: values.map(value => toCollectorAnyValue(value)),
  };
}

/**
 * Converts attributes to KeyValueList
 * @param attributes
 */
export function toCollectorKeyValueList(
  attributes: SpanAttributes
): opentelemetryProto.common.v1.KeyValueList {
  return {
    values: toCollectorAttributes(attributes),
  };
}

/**
 * Converts key and unknown value to KeyValue
 * @param value event value
 */
export function toCollectorAttributeKeyValue(
  key: string,
  value: unknown
): opentelemetryProto.common.v1.KeyValue {
  const anyValue = toCollectorAnyValue(value);
  return {
    key,
    value: anyValue,
  };
}

/**
 * Converts unknown value to AnyValue
 * @param value
 */
export function toCollectorAnyValue(
  value: unknown
): opentelemetryProto.common.v1.AnyValue {
  const anyValue: opentelemetryProto.common.v1.AnyValue = {};
  if (typeof value === 'string') {
    anyValue.stringValue = value;
  } else if (typeof value === 'boolean') {
    anyValue.boolValue = value;
  } else if (
    typeof value === 'number' &&
    value <= MAX_INTEGER_VALUE &&
    value >= MIN_INTEGER_VALUE &&
    Number.isInteger(value)
  ) {
    anyValue.intValue = value;
  } else if (typeof value === 'number') {
    anyValue.doubleValue = value;
  } else if (Array.isArray(value)) {
    anyValue.arrayValue = toCollectorArrayValue(value);
  } else if (value) {
    anyValue.kvlistValue = toCollectorKeyValueList(value as SpanAttributes);
  }
  return anyValue;
}

/**
 *
 * Converts events
 * @param events array of events
 */
export function toCollectorEvents(
  timedEvents: TimedEvent[]
): opentelemetryProto.trace.v1.Span.Event[] {
  return timedEvents.map(timedEvent => {
    const timeUnixNano = core.hrTimeToNanoseconds(timedEvent.time);
    const name = timedEvent.name;
    const attributes = toCollectorAttributes(timedEvent.attributes || {});
    const droppedAttributesCount = 0;

    const protoEvent: opentelemetryProto.trace.v1.Span.Event = {
      timeUnixNano,
      name,
      attributes,
      droppedAttributesCount,
    };

    return protoEvent;
  });
}

/**
 * Converts links
 * @param span
 * @param useHex - if ids should be kept as hex without converting to base64
 */
function toCollectorLinks(
  span: ReadableSpan,
  useHex?: boolean
): opentelemetryProto.trace.v1.Span.Link[] {
  return span.links.map((link: Link) => {
    const protoLink: opentelemetryProto.trace.v1.Span.Link = {
      traceId: useHex
        ? link.context.traceId
        : core.hexToBase64(link.context.traceId),
      spanId: useHex
        ? link.context.spanId
        : core.hexToBase64(link.context.spanId),
      attributes: toCollectorAttributes(link.attributes || {}),
      droppedAttributesCount: 0,
    };
    return protoLink;
  });
}

/**
 * Converts span
 * @param span
 * @param useHex - if ids should be kept as hex without converting to base64
 */
export function toCollectorSpan(
  span: ReadableSpan,
  useHex?: boolean
): opentelemetryProto.trace.v1.Span {
  return {
    traceId: useHex
      ? span.spanContext.traceId
      : core.hexToBase64(span.spanContext.traceId),
    spanId: useHex
      ? span.spanContext.spanId
      : core.hexToBase64(span.spanContext.spanId),
    parentSpanId: span.parentSpanId
      ? useHex
        ? span.parentSpanId
        : core.hexToBase64(span.parentSpanId)
      : undefined,
    traceState: toCollectorTraceState(span.spanContext.traceState),
    name: span.name,
    kind: toCollectorKind(span.kind),
    startTimeUnixNano: core.hrTimeToNanoseconds(span.startTime),
    endTimeUnixNano: core.hrTimeToNanoseconds(span.endTime),
    attributes: toCollectorAttributes(span.attributes),
    droppedAttributesCount: 0,
    events: toCollectorEvents(span.events),
    droppedEventsCount: 0,
    status: toCollectorStatus(span.status),
    links: toCollectorLinks(span, useHex),
    droppedLinksCount: 0,
  };
}

/**
 * Converts status
 * @param status
 */
export function toCollectorStatus(
  status: SpanStatus
): opentelemetryProto.trace.v1.SpanStatus {
  const spanStatus: opentelemetryProto.trace.v1.SpanStatus = {
    code: status.code,
  };
  if (typeof status.message !== 'undefined') {
    spanStatus.message = status.message;
  }
  return spanStatus;
}

/**
 * Converts resource
 * @param resource
 * @param additionalAttributes
 */
export function toCollectorResource(
  resource?: Resource,
  additionalAttributes: { [key: string]: unknown } = {}
): opentelemetryProto.resource.v1.Resource {
  const attr = Object.assign(
    {},
    additionalAttributes,
    resource ? resource.attributes : {}
  );
  const resourceProto: opentelemetryProto.resource.v1.Resource = {
    attributes: toCollectorAttributes(attr),
    droppedAttributesCount: 0,
  };

  return resourceProto;
}

/**
 * Converts span kind
 * @param kind
 */
export function toCollectorKind(
  kind: SpanKind
): opentelemetryProto.trace.v1.Span.SpanKind {
  const collectorKind = COLLECTOR_SPAN_KIND_MAPPING[kind];
  return typeof collectorKind === 'number'
    ? collectorKind
    : opentelemetryProto.trace.v1.Span.SpanKind.SPAN_KIND_UNSPECIFIED;
}

/**
 * Converts traceState
 * @param traceState
 */
export function toCollectorTraceState(
  traceState?: TraceState
): opentelemetryProto.trace.v1.Span.TraceState | undefined {
  if (!traceState) return undefined;
  return traceState.serialize();
}

/**
 * Prepares trace service request to be sent to collector
 * @param spans spans
 * @param collectorExporterBase
 * @param useHex - if ids should be kept as hex without converting to base64
 */
export function toCollectorExportTraceServiceRequest<
  T extends CollectorExporterConfigBase
>(
  spans: ReadableSpan[],
  collectorTraceExporterBase: CollectorExporterBase<
    T,
    ReadableSpan,
    opentelemetryProto.collector.trace.v1.ExportTraceServiceRequest
  >,
  useHex?: boolean
): opentelemetryProto.collector.trace.v1.ExportTraceServiceRequest {
  const groupedSpans: Map<
    Resource,
    Map<core.InstrumentationLibrary, ReadableSpan[]>
  > = groupSpansByResourceAndLibrary(spans);

  const additionalAttributes = Object.assign(
    {},
    collectorTraceExporterBase.attributes,
    {
      'service.name': collectorTraceExporterBase.serviceName,
    }
  );

  return {
    resourceSpans: toCollectorResourceSpans(
      groupedSpans,
      additionalAttributes,
      useHex
    ),
  };
}

/**
 * Takes an array of spans and groups them by resource and instrumentation
 * library
 * @param spans spans
 */
export function groupSpansByResourceAndLibrary(
  spans: ReadableSpan[]
): Map<Resource, Map<core.InstrumentationLibrary, ReadableSpan[]>> {
  return spans.reduce((spanMap, span) => {
    //group by resource
    let resourceSpans = spanMap.get(span.resource);
    if (!resourceSpans) {
      resourceSpans = new Map<core.InstrumentationLibrary, ReadableSpan[]>();
      spanMap.set(span.resource, resourceSpans);
    }
    //group by instrumentation library
    let libSpans = resourceSpans.get(span.instrumentationLibrary);
    if (!libSpans) {
      libSpans = new Array<ReadableSpan>();
      resourceSpans.set(span.instrumentationLibrary, libSpans);
    }
    libSpans.push(span);
    return spanMap;
  }, new Map<Resource, Map<core.InstrumentationLibrary, ReadableSpan[]>>());
}

/**
 * Convert to InstrumentationLibrarySpans
 * @param instrumentationLibrary
 * @param spans
 * @param useHex - if ids should be kept as hex without converting to base64
 */
function toCollectorInstrumentationLibrarySpans(
  instrumentationLibrary: core.InstrumentationLibrary,
  spans: ReadableSpan[],
  useHex?: boolean
): opentelemetryProto.trace.v1.InstrumentationLibrarySpans {
  return {
    spans: spans.map(span => toCollectorSpan(span, useHex)),
    instrumentationLibrary,
  };
}

/**
 * Returns a list of resource spans which will be exported to the collector
 * @param groupedSpans
 * @param baseAttributes
 * @param useHex - if ids should be kept as hex without converting to base64
 */
function toCollectorResourceSpans(
  groupedSpans: Map<Resource, Map<core.InstrumentationLibrary, ReadableSpan[]>>,
  baseAttributes: SpanAttributes,
  useHex?: boolean
): opentelemetryProto.trace.v1.ResourceSpans[] {
  return Array.from(groupedSpans, ([resource, libSpans]) => {
    return {
      resource: toCollectorResource(resource, baseAttributes),
      instrumentationLibrarySpans: Array.from(
        libSpans,
        ([instrumentationLibrary, spans]) =>
          toCollectorInstrumentationLibrarySpans(
            instrumentationLibrary,
            spans,
            useHex
          )
      ),
    };
  });
}
