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
  SumObserver,
  UpDownSumObserver,
  ValueObserver,
  ValueRecorder,
  ValueType,
} from '@opentelemetry/api-metrics';
import { hexToBase64, InstrumentationLibrary } from '@opentelemetry/core';
import * as metrics from '@opentelemetry/metrics';
import { Resource } from '@opentelemetry/resources';
import { ReadableSpan } from '@opentelemetry/tracing';
import * as assert from 'assert';
import * as collectorTypes from '../src/types';
import { opentelemetryProto } from '../src/types';

const meterProvider = new metrics.MeterProvider({
  interval: 30000,
  resource: new Resource({
    service: 'ui',
    version: 1,
    cost: 112.12,
  }),
});

const meter = meterProvider.getMeter('default', '0.0.1');

if (typeof Buffer === 'undefined') {
  (window as any).Buffer = {
    from: function (arr: []) {
      return new Uint8Array(arr);
    },
  };
}

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

export function mockDoubleCounter(): metrics.Metric<metrics.BoundCounter> &
  Counter {
  const name = 'double-counter';
  const metric =
    meter['_metrics'].get(name) ||
    meter.createCounter(name, {
      description: 'sample counter description',
      valueType: ValueType.DOUBLE,
    });
  metric.clear();
  metric.bind({});
  return metric;
}

export function mockObserver(
  callback: (observerResult: ObserverResult) => unknown,
  name = 'double-observer'
): metrics.Metric<metrics.BoundObserver> & ValueObserver {
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

export function mockSumObserver(
  callback: (observerResult: ObserverResult) => unknown,
  name = 'double-sum-observer'
): metrics.Metric<metrics.BoundObserver> & SumObserver {
  const metric =
    meter['_metrics'].get(name) ||
    meter.createSumObserver(
      name,
      {
        description: 'sample sum observer description',
        valueType: ValueType.DOUBLE,
      },
      callback
    );
  metric.clear();
  metric.bind({});
  return metric;
}

export function mockUpDownSumObserver(
  callback: (observerResult: ObserverResult) => unknown,
  name = 'double-up-down-sum-observer'
): metrics.Metric<metrics.BoundObserver> & UpDownSumObserver {
  const metric =
    meter['_metrics'].get(name) ||
    meter.createUpDownSumObserver(
      name,
      {
        description: 'sample up down sum observer description',
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
    traceId: '1f1008dc8e270e85c40a0d7c3939b278',
    spanId: '5e107261f64fa53e',
    traceFlags: TraceFlags.SAMPLED,
  },
  parentSpanId: '78a8915098864388',
  startTime: [1574120165, 429803070],
  endTime: [1574120165, 438688070],
  ended: true,
  status: { code: SpanStatusCode.OK },
  attributes: { component: 'document-load' },
  links: [
    {
      context: {
        traceId: '1f1008dc8e270e85c40a0d7c3939b278',
        spanId: '78a8915098864388',
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

export const mockedResources: Resource[] = [
  new Resource({ name: 'resource 1' }),
  new Resource({ name: 'resource 2' }),
];

export const mockedInstrumentationLibraries: InstrumentationLibrary[] = [
  {
    name: 'lib1',
    version: '0.0.1',
  },
  {
    name: 'lib2',
    version: '0.0.2',
  },
];

export const basicTrace: ReadableSpan[] = [
  {
    name: 'span1',
    kind: 0,
    spanContext: {
      traceId: '1f1008dc8e270e85c40a0d7c3939b278',
      spanId: '5e107261f64fa53e',
      traceFlags: TraceFlags.SAMPLED,
    },
    parentSpanId: '78a8915098864388',
    startTime: [1574120165, 429803070],
    endTime: [1574120165, 438688070],
    ended: true,
    status: { code: SpanStatusCode.OK },
    attributes: {},
    links: [],
    events: [],
    duration: [0, 8885000],
    resource: mockedResources[0],
    instrumentationLibrary: mockedInstrumentationLibraries[0],
  },
  {
    name: 'span2',
    kind: 0,
    spanContext: {
      traceId: '1f1008dc8e270e85c40a0d7c3939b278',
      spanId: 'f64fa53e5e107261',
      traceFlags: TraceFlags.SAMPLED,
    },
    parentSpanId: '78a8915098864388',
    startTime: [1575120165, 439803070],
    endTime: [1575120165, 448688070],
    ended: true,
    status: { code: SpanStatusCode.OK },
    attributes: {},
    links: [],
    events: [],
    duration: [0, 8775000],
    resource: mockedResources[0],
    instrumentationLibrary: mockedInstrumentationLibraries[0],
  },
  {
    name: 'span3',
    kind: 0,
    spanContext: {
      traceId: '1f1008dc8e270e85c40a0d7c3939b278',
      spanId: '07261f64fa53e5e1',
      traceFlags: TraceFlags.SAMPLED,
    },
    parentSpanId: 'a891578098864388',
    startTime: [1575120165, 439803070],
    endTime: [1575120165, 448688070],
    ended: true,
    status: { code: SpanStatusCode.OK },
    attributes: {},
    links: [],
    events: [],
    duration: [0, 8775000],
    resource: mockedResources[0],
    instrumentationLibrary: mockedInstrumentationLibraries[0],
  },
];

export const multiResourceTrace: ReadableSpan[] = [
  {
    ...basicTrace[0],
    resource: mockedResources[0],
  },
  {
    ...basicTrace[1],
    resource: mockedResources[1],
  },
  {
    ...basicTrace[2],
    resource: mockedResources[1],
  },
];

export const multiResourceMetricsGet = function (
  callback: (observerResult: ObserverResult) => unknown
): any[] {
  return [
    {
      ...mockCounter(),
      resource: mockedResources[0],
      instrumentationLibrary: mockedInstrumentationLibraries[0],
    },
    {
      ...mockObserver(callback),
      resource: mockedResources[1],
      instrumentationLibrary: mockedInstrumentationLibraries[0],
    },
    {
      ...mockCounter(),
      resource: mockedResources[0],
      instrumentationLibrary: mockedInstrumentationLibraries[0],
    },
  ];
};

export const multiInstrumentationLibraryMetricsGet = function (
  callback: (observerResult: ObserverResult) => unknown
): any[] {
  return [
    {
      ...mockCounter(),
      resource: mockedResources[0],
      instrumentationLibrary: mockedInstrumentationLibraries[0],
    },
    {
      ...mockObserver(callback),
      resource: mockedResources[0],
      instrumentationLibrary: mockedInstrumentationLibraries[1],
    },
    {
      ...mockCounter(),
      resource: mockedResources[0],
      instrumentationLibrary: mockedInstrumentationLibraries[0],
    },
  ];
};

export const multiInstrumentationLibraryTrace: ReadableSpan[] = [
  {
    ...basicTrace[0],
    instrumentationLibrary: mockedInstrumentationLibraries[0],
  },
  {
    ...basicTrace[1],
    instrumentationLibrary: mockedInstrumentationLibraries[0],
  },
  {
    ...basicTrace[2],
    instrumentationLibrary: mockedInstrumentationLibraries[1],
  },
];

export function ensureEventsAreCorrect(
  events: opentelemetryProto.trace.v1.Span.Event[]
) {
  assert.deepStrictEqual(
    events,
    [
      {
        timeUnixNano: 1574120165429803000,
        name: 'fetchStart',
        attributes: [],
        droppedAttributesCount: 0,
      },
      {
        timeUnixNano: 1574120165429803000,
        name: 'domainLookupStart',
        attributes: [],
        droppedAttributesCount: 0,
      },
      {
        timeUnixNano: 1574120165429803000,
        name: 'domainLookupEnd',
        attributes: [],
        droppedAttributesCount: 0,
      },
      {
        timeUnixNano: 1574120165429803000,
        name: 'connectStart',
        attributes: [],
        droppedAttributesCount: 0,
      },
      {
        timeUnixNano: 1574120165429803000,
        name: 'connectEnd',
        attributes: [],
        droppedAttributesCount: 0,
      },
      {
        timeUnixNano: 1574120165435513000,
        name: 'requestStart',
        attributes: [],
        droppedAttributesCount: 0,
      },
      {
        timeUnixNano: 1574120165436923100,
        name: 'responseStart',
        attributes: [],
        droppedAttributesCount: 0,
      },
      {
        timeUnixNano: 1574120165438688000,
        name: 'responseEnd',
        attributes: [],
        droppedAttributesCount: 0,
      },
    ],
    'events are incorrect'
  );
}

export function ensureAttributesAreCorrect(
  attributes: opentelemetryProto.common.v1.KeyValue[]
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

export function ensureLinksAreCorrect(
  attributes: opentelemetryProto.trace.v1.Span.Link[],
  useHex?: boolean
) {
  assert.deepStrictEqual(
    attributes,
    [
      {
        traceId: useHex ? traceIdHex : hexToBase64(traceIdHex),
        spanId: useHex ? parentIdHex : hexToBase64(parentIdHex),
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

export function ensureSpanIsCorrect(
  span: collectorTypes.opentelemetryProto.trace.v1.Span,
  useHex = true
) {
  if (span.attributes) {
    ensureAttributesAreCorrect(span.attributes);
  }
  if (span.events) {
    ensureEventsAreCorrect(span.events);
  }
  if (span.links) {
    ensureLinksAreCorrect(span.links, useHex);
  }
  assert.deepStrictEqual(
    span.traceId,
    useHex ? traceIdHex : hexToBase64(traceIdHex),
    'traceId is' + ' wrong'
  );
  assert.deepStrictEqual(
    span.spanId,
    useHex ? spanIdHex : hexToBase64(spanIdHex),
    'spanId is' + ' wrong'
  );
  assert.deepStrictEqual(
    span.parentSpanId,
    useHex ? parentIdHex : hexToBase64(parentIdHex),
    'parentIdArr is wrong'
  );
  assert.strictEqual(span.name, 'documentFetch', 'name is wrong');
  assert.strictEqual(
    span.kind,
    opentelemetryProto.trace.v1.Span.SpanKind.SPAN_KIND_INTERNAL,
    'kind is wrong'
  );
  assert.strictEqual(
    span.startTimeUnixNano,
    1574120165429803008,
    'startTimeUnixNano is wrong'
  );
  assert.strictEqual(
    span.endTimeUnixNano,
    1574120165438688000,
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
    { code: SpanStatusCode.OK },
    'status is wrong'
  );
}

export function ensureWebResourceIsCorrect(
  resource: collectorTypes.opentelemetryProto.resource.v1.Resource
) {
  assert.deepStrictEqual(resource, {
    attributes: [
      {
        key: 'service.name',
        value: {
          stringValue: 'bar',
        },
      },
      {
        key: 'service',
        value: {
          stringValue: 'ui',
        },
      },
      {
        key: 'version',
        value: {
          intValue: 1,
        },
      },
      {
        key: 'cost',
        value: {
          doubleValue: 112.12,
        },
      },
    ],
    droppedAttributesCount: 0,
  });
}

export function ensureCounterIsCorrect(
  metric: collectorTypes.opentelemetryProto.metrics.v1.Metric,
  time: number
) {
  assert.deepStrictEqual(metric, {
    name: 'int-counter',
    description: 'sample counter description',
    unit: '1',
    intSum: {
      dataPoints: [
        {
          labels: [],
          value: 1,
          startTimeUnixNano: 1592602232694000000,
          timeUnixNano: time,
        },
      ],
      isMonotonic: true,
      aggregationTemporality:
        collectorTypes.opentelemetryProto.metrics.v1.AggregationTemporality
          .AGGREGATION_TEMPORALITY_CUMULATIVE,
    },
  });
}

export function ensureDoubleCounterIsCorrect(
  metric: collectorTypes.opentelemetryProto.metrics.v1.Metric,
  time: number
) {
  assert.deepStrictEqual(metric, {
    name: 'double-counter',
    description: 'sample counter description',
    unit: '1',
    doubleSum: {
      dataPoints: [
        {
          labels: [],
          value: 8,
          startTimeUnixNano: 1592602232694000000,
          timeUnixNano: time,
        },
      ],
      isMonotonic: true,
      aggregationTemporality:
        collectorTypes.opentelemetryProto.metrics.v1.AggregationTemporality
          .AGGREGATION_TEMPORALITY_CUMULATIVE,
    },
  });
}

export function ensureObserverIsCorrect(
  metric: collectorTypes.opentelemetryProto.metrics.v1.Metric,
  time: number,
  value: number,
  name = 'double-observer'
) {
  assert.deepStrictEqual(metric, {
    name,
    description: 'sample observer description',
    unit: '1',
    doubleGauge: {
      dataPoints: [
        {
          labels: [],
          value,
          startTimeUnixNano: 1592602232694000000,
          timeUnixNano: time,
        },
      ],
    },
  });
}

export function ensureSumObserverIsCorrect(
  metric: collectorTypes.opentelemetryProto.metrics.v1.Metric,
  time: number,
  value: number,
  name = 'double-sum-observer'
) {
  assert.deepStrictEqual(metric, {
    name,
    description: 'sample sum observer description',
    unit: '1',
    doubleSum: {
      isMonotonic: true,
      dataPoints: [
        {
          labels: [],
          value,
          startTimeUnixNano: 1592602232694000000,
          timeUnixNano: time,
        },
      ],
      aggregationTemporality:
        collectorTypes.opentelemetryProto.metrics.v1.AggregationTemporality
          .AGGREGATION_TEMPORALITY_CUMULATIVE,
    },
  });
}

export function ensureUpDownSumObserverIsCorrect(
  metric: collectorTypes.opentelemetryProto.metrics.v1.Metric,
  time: number,
  value: number,
  name = 'double-up-down-sum-observer'
) {
  assert.deepStrictEqual(metric, {
    name,
    description: 'sample up down sum observer description',
    unit: '1',
    doubleSum: {
      isMonotonic: false,
      dataPoints: [
        {
          labels: [],
          value,
          startTimeUnixNano: 1592602232694000000,
          timeUnixNano: time,
        },
      ],
      aggregationTemporality:
        collectorTypes.opentelemetryProto.metrics.v1.AggregationTemporality
          .AGGREGATION_TEMPORALITY_CUMULATIVE,
    },
  });
}

export function ensureValueRecorderIsCorrect(
  metric: collectorTypes.opentelemetryProto.metrics.v1.Metric,
  time: number,
  explicitBounds: (number | null)[] = [Infinity],
  bucketCounts: number[] = [2, 0]
) {
  assert.deepStrictEqual(metric, {
    name: 'int-recorder',
    description: 'sample recorder description',
    unit: '1',
    intHistogram: {
      dataPoints: [
        {
          labels: [],
          sum: 21,
          count: 2,
          startTimeUnixNano: 1592602232694000000,
          timeUnixNano: time,
          bucketCounts,
          explicitBounds,
        },
      ],
      aggregationTemporality:
        collectorTypes.opentelemetryProto.metrics.v1.AggregationTemporality
          .AGGREGATION_TEMPORALITY_CUMULATIVE,
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

export function ensureHeadersContain(
  actual: { [key: string]: string },
  expected: { [key: string]: string }
) {
  Object.entries(expected).forEach(([k, v]) => {
    assert.strictEqual(
      v,
      actual[k],
      `Expected ${actual} to contain ${k}: ${v}`
    );
  });
}
