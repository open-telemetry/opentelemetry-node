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

import { SpanAttributes, SpanKind, SpanStatusCode } from '@opentelemetry/api';

/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unused-vars */

export namespace opentelemetryProto {
  export namespace collector {
    export namespace trace.v1 {
      export interface TraceService {
        service: opentelemetryProto.collector.trace.v1.TraceService;
      }

      export interface ExportTraceServiceRequest {
        resourceSpans: opentelemetryProto.trace.v1.ResourceSpans[];
      }
    }
    export namespace metrics.v1 {
      export interface ExportMetricsServiceRequest {
        resourceMetrics: opentelemetryProto.metrics.v1.ResourceMetrics[];
      }
    }
  }

  export namespace resource.v1 {
    export interface Resource {
      attributes: opentelemetryProto.common.v1.KeyValue[];
      droppedAttributesCount: number;
    }
  }

  export namespace metrics.v1 {
    export interface Metric {
      name: string;
      description: string;
      unit: string;
      // data:
      intGauge?: opentelemetryProto.metrics.v1.Gauge;
      doubleGauge?: opentelemetryProto.metrics.v1.Gauge;
      intSum?: opentelemetryProto.metrics.v1.Sum;
      doubleSum?: opentelemetryProto.metrics.v1.Sum;
      intHistogram?: opentelemetryProto.metrics.v1.Histogram;
      doubleHistogram?: opentelemetryProto.metrics.v1.Histogram;
    }

    export interface Gauge {
      dataPoints: opentelemetryProto.metrics.v1.DataPoint[];
    }

    export interface Sum {
      dataPoints: opentelemetryProto.metrics.v1.DataPoint[];
      aggregationTemporality: opentelemetryProto.metrics.v1.AggregationTemporality;
      isMonotonic: boolean;
    }

    export interface Histogram {
      dataPoints: opentelemetryProto.metrics.v1.HistogramDataPoint[];
      aggregationTemporality: opentelemetryProto.metrics.v1.AggregationTemporality;
    }

    export interface DataPoint {
      labels: opentelemetryProto.common.v1.StringKeyValue[];
      startTimeUnixNano: number;
      timeUnixNano: number;
      value: number;
      exemplars?: opentelemetryProto.metrics.v1.Exemplar[];
    }

    export interface Exemplar {
      filteredLabels: opentelemetryProto.common.v1.StringKeyValue[];
      timeUnixNano: number;
      value: number;
      spanId: Uint8Array;
      traceId: Uint8Array;
    }

    export interface HistogramDataPoint {
      labels: opentelemetryProto.common.v1.StringKeyValue[];
      startTimeUnixNano: number;
      timeUnixNano: number;
      count: number;
      sum: number;
      bucketCounts?: number[];
      explicitBounds?: number[];
      exemplars?: opentelemetryProto.metrics.v1.Exemplar[][];
    }

    export interface InstrumentationLibraryMetrics {
      instrumentationLibrary?: opentelemetryProto.common.v1.InstrumentationLibrary;
      metrics: opentelemetryProto.metrics.v1.Metric[];
    }

    export interface ResourceMetrics {
      resource?: opentelemetryProto.resource.v1.Resource;
      instrumentationLibraryMetrics: opentelemetryProto.metrics.v1.InstrumentationLibraryMetrics[];
    }

    export enum AggregationTemporality {
      // UNSPECIFIED is the default AggregationTemporality, it MUST not be used.
      AGGREGATION_TEMPORALITY_UNSPECIFIED = 0,

      // DELTA is an AggregationTemporality for a metric aggregator which reports
      // changes since last report time. Successive metrics contain aggregation of
      // values from continuous and non-overlapping intervals.
      //
      // The values for a DELTA metric are based only on the time interval
      // associated with one measurement cycle. There is no dependency on
      // previous measurements like is the case for CUMULATIVE metrics.
      //
      // For example, consider a system measuring the number of requests that
      // it receives and reports the sum of these requests every second as a
      // DELTA metric:
      //
      //   1. The system starts receiving at time=t_0.
      //   2. A request is received, the system measures 1 request.
      //   3. A request is received, the system measures 1 request.
      //   4. A request is received, the system measures 1 request.
      //   5. The 1 second collection cycle ends. A metric is exported for the
      //      number of requests received over the interval of time t_0 to
      //      t_0+1 with a value of 3.
      //   6. A request is received, the system measures 1 request.
      //   7. A request is received, the system measures 1 request.
      //   8. The 1 second collection cycle ends. A metric is exported for the
      //      number of requests received over the interval of time t_0+1 to
      //      t_0+2 with a value of 2.
      AGGREGATION_TEMPORALITY_DELTA = 1,

      // CUMULATIVE is an AggregationTemporality for a metric aggregator which
      // reports changes since a fixed start time. This means that current values
      // of a CUMULATIVE metric depend on all previous measurements since the
      // start time. Because of this, the sender is required to retain this state
      // in some form. If this state is lost or invalidated, the CUMULATIVE metric
      // values MUST be reset and a new fixed start time following the last
      // reported measurement time sent MUST be used.
      //
      // For example, consider a system measuring the number of requests that
      // it receives and reports the sum of these requests every second as a
      // CUMULATIVE metric:
      //
      //   1. The system starts receiving at time=t_0.
      //   2. A request is received, the system measures 1 request.
      //   3. A request is received, the system measures 1 request.
      //   4. A request is received, the system measures 1 request.
      //   5. The 1 second collection cycle ends. A metric is exported for the
      //      number of requests received over the interval of time t_0 to
      //      t_0+1 with a value of 3.
      //   6. A request is received, the system measures 1 request.
      //   7. A request is received, the system measures 1 request.
      //   8. The 1 second collection cycle ends. A metric is exported for the
      //      number of requests received over the interval of time t_0 to
      //      t_0+2 with a value of 5.
      //   9. The system experiences a fault and loses state.
      //   10. The system recovers and resumes receiving at time=t_1.
      //   11. A request is received, the system measures 1 request.
      //   12. The 1 second collection cycle ends. A metric is exported for the
      //      number of requests received over the interval of time t_1 to
      //      t_0+1 with a value of 1.
      //
      // Note: Even though, when reporting changes since last report time, using
      // CUMULATIVE is valid, it is not recommended. This may cause problems for
      // systems that do not use start_time to determine when the aggregation
      // value was reset (e.g. Prometheus).
      AGGREGATION_TEMPORALITY_CUMULATIVE = 2,
    }
  }

  export namespace trace.v1 {
    export namespace ConstantSampler {
      export enum ConstantDecision {
        ALWAYS_OFF = 0,
        ALWAYS_ON = 1,
        ALWAYS_PARENT = 2,
      }
    }
    export namespace Span {
      export interface Event {
        timeUnixNano: number;
        name: string;
        attributes?: opentelemetryProto.common.v1.KeyValue[];
        droppedAttributesCount: number;
      }

      export interface Link {
        traceId: string;
        spanId: string;
        traceState?: opentelemetryProto.trace.v1.Span.TraceState;
        attributes?: opentelemetryProto.common.v1.KeyValue[];
        droppedAttributesCount: number;
      }

      export enum SpanKind {
        SPAN_KIND_UNSPECIFIED,
        SPAN_KIND_INTERNAL,
        SPAN_KIND_SERVER,
        SPAN_KIND_CLIENT,
        SPAN_KIND_PRODUCER,
        SPAN_KIND_CONSUMER,
      }

      export type TraceState = string | undefined;
    }

    export interface ConstantSampler {
      decision?: opentelemetryProto.trace.v1.ConstantSampler.ConstantDecision;
    }

    export interface InstrumentationLibrarySpans {
      instrumentationLibrary?: opentelemetryProto.common.v1.InstrumentationLibrary;
      spans: opentelemetryProto.trace.v1.Span[];
    }

    export interface ProbabilitySampler {
      samplingProbability?: number | null;
    }

    export interface RateLimitingSampler {
      qps?: number | null;
    }

    export interface ResourceSpans {
      resource?: opentelemetryProto.resource.v1.Resource;
      instrumentationLibrarySpans: opentelemetryProto.trace.v1.InstrumentationLibrarySpans[];
    }

    export interface Span {
      traceId: string;
      spanId: string;
      traceState: opentelemetryProto.trace.v1.Span.TraceState;
      parentSpanId?: string;
      name?: string;
      kind?: opentelemetryProto.trace.v1.Span.SpanKind;
      startTimeUnixNano?: number;
      endTimeUnixNano?: number;
      attributes?: opentelemetryProto.common.v1.KeyValue[];
      droppedAttributesCount: number;
      events?: opentelemetryProto.trace.v1.Span.Event[];
      droppedEventsCount: number;
      links?: opentelemetryProto.trace.v1.Span.Link[];
      droppedLinksCount: number;
      status?: SpanStatus;
    }

    export interface SpanStatus {
      /** The status code of this message. */
      code: SpanStatusCode;
      /** A developer-facing error message. */
      message?: string;
    }

    export interface TraceConfig {
      constantSampler?: ConstantSampler | null;
      probabilitySampler?: ProbabilitySampler | null;
      rateLimitingSampler?: RateLimitingSampler | null;
    }
  }
  export namespace common.v1 {
    export interface KeyValue {
      key: string;
      value: AnyValue;
    }

    export type ArrayValue = {
      values: AnyValue[];
    };

    export interface KeyValueList {
      values: KeyValue[];
    }

    export type AnyValue = {
      stringValue?: string;
      boolValue?: boolean;
      intValue?: number;
      doubleValue?: number;
      arrayValue?: ArrayValue;
      kvlistValue?: KeyValueList;
    };

    export interface InstrumentationLibrary {
      name: string;
      version?: string;
    }

    export interface StringKeyValue {
      key: string;
      value: string;
    }

    export enum ValueType {
      STRING,
      INT,
      DOUBLE,
      BOOL,
    }
  }
}

/**
 * Interface for handling error
 */
export class CollectorExporterError extends Error {
  readonly code?: number;
  override readonly name: string = 'CollectorExporterError';
  readonly data?: string;

  constructor(message?: string, code?: number, data?: string) {
    super(message);
    this.data = data;
    this.code = code;
  }
}

/**
 * Interface for handling export service errors
 */
export interface ExportServiceError {
  name: string;
  code: number;
  details: string;
  metadata: { [key: string]: unknown };
  message: string;
  stack: string;
}

/**
 * Collector Exporter base config
 */
export interface CollectorExporterConfigBase {
  headers?: Partial<Record<string, unknown>>;
  hostname?: string;
  attributes?: SpanAttributes;
  url?: string;
  concurrencyLimit?: number;
}

/**
 * Mapping between api SpanKind and proto SpanKind
 */
export const COLLECTOR_SPAN_KIND_MAPPING = {
  [SpanKind.INTERNAL]:
    opentelemetryProto.trace.v1.Span.SpanKind.SPAN_KIND_INTERNAL,
  [SpanKind.SERVER]: opentelemetryProto.trace.v1.Span.SpanKind.SPAN_KIND_SERVER,
  [SpanKind.CLIENT]: opentelemetryProto.trace.v1.Span.SpanKind.SPAN_KIND_CLIENT,
  [SpanKind.PRODUCER]:
    opentelemetryProto.trace.v1.Span.SpanKind.SPAN_KIND_PRODUCER,
  [SpanKind.CONSUMER]:
    opentelemetryProto.trace.v1.Span.SpanKind.SPAN_KIND_CONSUMER,
};
