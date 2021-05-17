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

import { SpanStatusCode, TraceFlags } from '@opentelemetry/api';
import {
  Counter,
  ObserverResult,
  ValueObserver,
  ValueRecorder,
  ValueType,
} from '@opentelemetry/api-metrics';
import { hexToBase64 } from '@opentelemetry/core';
import { collectorTypes } from '@opentelemetry/exporter-collector';
import * as metrics from '@opentelemetry/metrics';
import { Resource } from '@opentelemetry/resources';
import { ReadableSpan } from '@opentelemetry/tracing';
import * as assert from 'assert';
import { Stream } from 'stream';

const meterProvider = new metrics.MeterProvider({
  interval: 30000,
  resource: new Resource({
    service: 'ui',
    version: 1,
    cost: 112.12,
  }),
});

const meter = meterProvider.getMeter('default', '0.0.1');

export function mockCounter(): metrics.Metric<metrics.BoundCounter> & Counter {
  const name = 'int-counter';
  const metric =
    meter['_metrics'].get(name) ||
    meter.createCounter(name, {
      description: 'sample counter description',
      valueType: ValueType.INT,
    });
  metric.clear();
  metric.bind({});
  return metric;
}

export function mockObserver(
  callback: (observerResult: ObserverResult) => void
): metrics.Metric<metrics.BoundCounter> & ValueObserver {
  const name = 'double-observer';
  const metric =
    meter['_metrics'].get(name) ||
    meter.createValueObserver(
      name,
      {
        description: 'sample observer description',
        valueType: ValueType.DOUBLE,
      },
      callback
    );
  metric.clear();
  metric.bind({});
  return metric;
}

export function mockValueRecorder(): metrics.Metric<metrics.BoundValueRecorder> &
  ValueRecorder {
  const name = 'int-recorder';
  const metric =
    meter['_metrics'].get(name) ||
    meter.createValueRecorder(name, {
      description: 'sample recorder description',
      valueType: ValueType.INT,
      boundaries: [0, 100],
    });
  metric.clear();
  metric.bind({});
  return metric;
}

const traceIdHex = '1f1008dc8e270e85c40a0d7c3939b278';
const spanIdHex = '5e107261f64fa53e';
const parentIdHex = '78a8915098864388';

export const mockedReadableSpan: ReadableSpan = {
  name: 'documentFetch',
  kind: 0,
  spanContext: {
    traceId: traceIdHex,
    spanId: spanIdHex,
    traceFlags: TraceFlags.SAMPLED,
  },
  parentSpanId: parentIdHex,
  startTime: [1574120165, 429803070],
  endTime: [1574120165, 438688070],
  ended: true,
  status: { code: SpanStatusCode.OK },
  attributes: { component: 'document-load' },
  links: [
    {
      context: {
        traceId: traceIdHex,
        spanId: parentIdHex,
      },
      attributes: { component: 'document-load' },
    },
  ],
  events: [
    { name: 'fetchStart', time: [1574120165, 429803070] },
    {
      name: 'domainLookupStart',
      time: [1574120165, 429803070],
    },
    { name: 'domainLookupEnd', time: [1574120165, 429803070] },
    {
      name: 'connectStart',
      time: [1574120165, 429803070],
    },
    { name: 'connectEnd', time: [1574120165, 429803070] },
    {
      name: 'requestStart',
      time: [1574120165, 435513070],
    },
    { name: 'responseStart', time: [1574120165, 436923070] },
    {
      name: 'responseEnd',
      time: [1574120165, 438688070],
    },
  ],
  duration: [0, 8885000],
  resource: new Resource({
    service: 'ui',
    version: 1,
    cost: 112.12,
  }),
  instrumentationLibrary: { name: 'default', version: '0.0.1' },
};

export function ensureProtoEventsAreCorrect(
  events: collectorTypes.opentelemetryProto.trace.v1.Span.Event[]
) {
  assert.deepStrictEqual(
    events,
    [
      {
        timeUnixNano: '1574120165429803008',
        name: 'fetchStart',
        droppedAttributesCount: 0,
      },
      {
        timeUnixNano: '1574120165429803008',
        name: 'domainLookupStart',
        droppedAttributesCount: 0,
      },
      {
        timeUnixNano: '1574120165429803008',
        name: 'domainLookupEnd',
        droppedAttributesCount: 0,
      },
      {
        timeUnixNano: '1574120165429803008',
        name: 'connectStart',
        droppedAttributesCount: 0,
      },
      {
        timeUnixNano: '1574120165429803008',
        name: 'connectEnd',
        droppedAttributesCount: 0,
      },
      {
        timeUnixNano: '1574120165435513088',
        name: 'requestStart',
        droppedAttributesCount: 0,
      },
      {
        timeUnixNano: '1574120165436923136',
        name: 'responseStart',
        droppedAttributesCount: 0,
      },
      {
        timeUnixNano: '1574120165438688000',
        name: 'responseEnd',
        droppedAttributesCount: 0,
      },
    ],
    'events are incorrect'
  );
}

export function ensureProtoAttributesAreCorrect(
  attributes: collectorTypes.opentelemetryProto.common.v1.KeyValue[]
) {
  assert.deepStrictEqual(
    attributes,
    [
      {
        key: 'component',
        value: {
          stringValue: 'document-load',
        },
      },
    ],
    'attributes are incorrect'
  );
}

export function ensureProtoLinksAreCorrect(
  attributes: collectorTypes.opentelemetryProto.trace.v1.Span.Link[]
) {
  assert.deepStrictEqual(
    attributes,
    [
      {
        traceId: hexToBase64(traceIdHex),
        spanId: hexToBase64(parentIdHex),
        attributes: [
          {
            key: 'component',
            value: {
              stringValue: 'document-load',
            },
          },
        ],
        droppedAttributesCount: 0,
      },
    ],
    'links are incorrect'
  );
}

export function ensureProtoSpanIsCorrect(
  span: collectorTypes.opentelemetryProto.trace.v1.Span
) {
  if (span.attributes) {
    ensureProtoAttributesAreCorrect(span.attributes);
  }
  if (span.events) {
    ensureProtoEventsAreCorrect(span.events);
  }
  if (span.links) {
    ensureProtoLinksAreCorrect(span.links);
  }
  assert.deepStrictEqual(
    span.traceId,
    hexToBase64(traceIdHex),
    'traceId is' + ' wrong'
  );
  assert.deepStrictEqual(
    span.spanId,
    hexToBase64(spanIdHex),
    'spanId is' + ' wrong'
  );
  assert.deepStrictEqual(
    span.parentSpanId,
    hexToBase64(parentIdHex),
    'parentIdArr is wrong'
  );
  assert.strictEqual(span.name, 'documentFetch', 'name is wrong');
  assert.strictEqual(span.kind, 'SPAN_KIND_INTERNAL', 'kind is wrong');
  assert.strictEqual(
    span.startTimeUnixNano,
    '1574120165429803008',
    'startTimeUnixNano is wrong'
  );
  assert.strictEqual(
    span.endTimeUnixNano,
    '1574120165438688000',
    'endTimeUnixNano is wrong'
  );
  assert.strictEqual(
    span.droppedAttributesCount,
    0,
    'droppedAttributesCount is wrong'
  );
  assert.strictEqual(span.droppedEventsCount, 0, 'droppedEventsCount is wrong');
  assert.strictEqual(span.droppedLinksCount, 0, 'droppedLinksCount is wrong');
  assert.deepStrictEqual(
    span.status,
    { code: 'STATUS_CODE_OK' },
    'status is wrong'
  );
}

export function ensureExportedCounterIsCorrect(
  metric: collectorTypes.opentelemetryProto.metrics.v1.Metric,
  time?: number
) {
  assert.deepStrictEqual(metric, {
    name: 'int-counter',
    description: 'sample counter description',
    unit: '1',
    intSum: {
      dataPoints: [
        {
          value: '1',
          startTimeUnixNano: '1592602232694000128',
          timeUnixNano: String(time),
        },
      ],
      isMonotonic: true,
      aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
    },
  });
}

export function ensureExportedObserverIsCorrect(
  metric: collectorTypes.opentelemetryProto.metrics.v1.Metric,
  time?: number
) {
  assert.deepStrictEqual(metric, {
    name: 'double-observer',
    description: 'sample observer description',
    unit: '1',
    doubleGauge: {
      dataPoints: [
        {
          value: 6,
          startTimeUnixNano: '1592602232694000128',
          timeUnixNano: String(time),
        },
      ],
    },
  });
}

export function ensureExportedValueRecorderIsCorrect(
  metric: collectorTypes.opentelemetryProto.metrics.v1.Metric,
  time?: number,
  explicitBounds: number[] = [Infinity],
  bucketCounts: string[] = ['2', '0']
) {
  assert.deepStrictEqual(metric, {
    name: 'int-recorder',
    description: 'sample recorder description',
    unit: '1',
    intHistogram: {
      dataPoints: [
        {
          sum: '21',
          count: '2',
          startTimeUnixNano: '1592602232694000128',
          timeUnixNano: time,
          bucketCounts,
          explicitBounds,
        },
      ],
      aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
    },
  });
}

export function ensureExportTraceServiceRequestIsSet(
  json: collectorTypes.opentelemetryProto.collector.trace.v1.ExportTraceServiceRequest
) {
  const resourceSpans = json.resourceSpans;
  assert.strictEqual(
    resourceSpans && resourceSpans.length,
    1,
    'resourceSpans is missing'
  );

  const resource = resourceSpans[0].resource;
  assert.strictEqual(!!resource, true, 'resource is missing');

  const instrumentationLibrarySpans =
    resourceSpans[0].instrumentationLibrarySpans;
  assert.strictEqual(
    instrumentationLibrarySpans && instrumentationLibrarySpans.length,
    1,
    'instrumentationLibrarySpans is missing'
  );

  const instrumentationLibrary =
    instrumentationLibrarySpans[0].instrumentationLibrary;
  assert.strictEqual(
    !!instrumentationLibrary,
    true,
    'instrumentationLibrary is missing'
  );

  const spans = instrumentationLibrarySpans[0].spans;
  assert.strictEqual(spans && spans.length, 1, 'spans are missing');
}

export function ensureExportMetricsServiceRequestIsSet(
  json: collectorTypes.opentelemetryProto.collector.metrics.v1.ExportMetricsServiceRequest
) {
  const resourceMetrics = json.resourceMetrics;
  assert.strictEqual(
    resourceMetrics.length,
    1,
    'resourceMetrics has incorrect length'
  );

  const resource = resourceMetrics[0].resource;
  assert.strictEqual(!!resource, true, 'resource is missing');

  const instrumentationLibraryMetrics =
    resourceMetrics[0].instrumentationLibraryMetrics;
  assert.strictEqual(
    instrumentationLibraryMetrics && instrumentationLibraryMetrics.length,
    1,
    'instrumentationLibraryMetrics is missing'
  );

  const instrumentationLibrary =
    instrumentationLibraryMetrics[0].instrumentationLibrary;
  assert.strictEqual(
    !!instrumentationLibrary,
    true,
    'instrumentationLibrary is missing'
  );

  const metrics = resourceMetrics[0].instrumentationLibraryMetrics[0].metrics;
  assert.strictEqual(metrics.length, 3, 'Metrics are missing');
}

export class MockedResponse extends Stream {
  constructor(private _code: number, private _msg?: string) {
    super();
  }

  send(data: string) {
    this.emit('data', data);
    this.emit('end');
  }

  get statusCode() {
    return this._code;
  }

  get statusMessage() {
    return this._msg;
  }
}
