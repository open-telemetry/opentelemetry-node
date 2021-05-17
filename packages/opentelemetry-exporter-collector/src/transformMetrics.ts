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

import { SpanAttributes, HrTime } from '@opentelemetry/api';
import { Labels, ValueType } from '@opentelemetry/api-metrics';
import * as core from '@opentelemetry/core';
import {
  AggregatorKind,
  Histogram,
  MetricKind,
  MetricRecord,
} from '@opentelemetry/metrics';
import { Resource } from '@opentelemetry/resources';
import { CollectorExporterBase } from './CollectorExporterBase';
import { toCollectorResource } from './transform';
import { CollectorExporterConfigBase, opentelemetryProto } from './types';

/**
 * Converts labels
 * @param labels
 */
export function toCollectorLabels(
  labels: Labels
): opentelemetryProto.common.v1.StringKeyValue[] {
  return Object.entries(labels).map(([key, value]) => {
    return { key, value: String(value) };
  });
}

/**
 * Given a MetricDescriptor, return its temporality in a compatible format with the collector
 * @param descriptor
 */
export function toAggregationTemporality(
  metric: MetricRecord
): opentelemetryProto.metrics.v1.AggregationTemporality {
  if (metric.descriptor.metricKind === MetricKind.VALUE_OBSERVER) {
    return opentelemetryProto.metrics.v1.AggregationTemporality
      .AGGREGATION_TEMPORALITY_UNSPECIFIED;
  }

  return metric.aggregationTemporality;
}

/**
 * Returns an DataPoint which can have integers or doublle values
 * @param metric
 * @param startTime
 */
export function toDataPoint(
  metric: MetricRecord,
  startTime: number
): opentelemetryProto.metrics.v1.DataPoint {
  return {
    labels: toCollectorLabels(metric.labels),
    value: metric.aggregator.toPoint().value as number,
    startTimeUnixNano: startTime,
    timeUnixNano: core.hrTimeToNanoseconds(
      metric.aggregator.toPoint().timestamp
    ),
  };
}

/**
 * Returns a HistogramPoint to the collector
 * @param metric
 * @param startTime
 */
export function toHistogramPoint(
  metric: MetricRecord,
  startTime: number
): opentelemetryProto.metrics.v1.HistogramDataPoint {
  const { value, timestamp } = metric.aggregator.toPoint() as {
    value: Histogram;
    timestamp: HrTime;
  };
  return {
    labels: toCollectorLabels(metric.labels),
    sum: value.sum,
    count: value.count,
    startTimeUnixNano: startTime,
    timeUnixNano: core.hrTimeToNanoseconds(timestamp),
    bucketCounts: value.buckets.counts,
    explicitBounds: value.buckets.boundaries,
  };
}

/**
 * Converts a metric to be compatible with the collector
 * @param metric
 * @param startTime start time in nanoseconds
 */
export function toCollectorMetric(
  metric: MetricRecord,
  startTime: number
): opentelemetryProto.metrics.v1.Metric {
  const metricCollector: opentelemetryProto.metrics.v1.Metric = {
    name: metric.descriptor.name,
    description: metric.descriptor.description,
    unit: metric.descriptor.unit,
  };

  if (
    metric.aggregator.kind === AggregatorKind.SUM ||
    metric.descriptor.metricKind === MetricKind.SUM_OBSERVER ||
    metric.descriptor.metricKind === MetricKind.UP_DOWN_SUM_OBSERVER
  ) {
    const result = {
      dataPoints: [toDataPoint(metric, startTime)],
      isMonotonic:
        metric.descriptor.metricKind === MetricKind.COUNTER ||
        metric.descriptor.metricKind === MetricKind.SUM_OBSERVER,
      aggregationTemporality: toAggregationTemporality(metric),
    };
    if (metric.descriptor.valueType === ValueType.INT) {
      metricCollector.intSum = result;
    } else {
      metricCollector.doubleSum = result;
    }
  } else if (metric.aggregator.kind === AggregatorKind.LAST_VALUE) {
    const result = {
      dataPoints: [toDataPoint(metric, startTime)],
    };
    if (metric.descriptor.valueType === ValueType.INT) {
      metricCollector.intGauge = result;
    } else {
      metricCollector.doubleGauge = result;
    }
  } else if (metric.aggregator.kind === AggregatorKind.HISTOGRAM) {
    const result = {
      dataPoints: [toHistogramPoint(metric, startTime)],
      aggregationTemporality: toAggregationTemporality(metric),
    };
    if (metric.descriptor.valueType === ValueType.INT) {
      metricCollector.intHistogram = result;
    } else {
      metricCollector.doubleHistogram = result;
    }
  }

  return metricCollector;
}

/**
 * Prepares metric service request to be sent to collector
 * @param metrics metrics
 * @param startTime start time of the metric in nanoseconds
 * @param collectorMetricExporterBase
 */
export function toCollectorExportMetricServiceRequest<
  T extends CollectorExporterConfigBase
>(
  metrics: MetricRecord[],
  startTime: number,
  collectorExporterBase: CollectorExporterBase<
    T,
    MetricRecord,
    opentelemetryProto.collector.metrics.v1.ExportMetricsServiceRequest
  >
): opentelemetryProto.collector.metrics.v1.ExportMetricsServiceRequest {
  const groupedMetrics: Map<
    Resource,
    Map<core.InstrumentationLibrary, MetricRecord[]>
  > = groupMetricsByResourceAndLibrary(metrics);
  const additionalAttributes = Object.assign(
    {},
    collectorExporterBase.attributes,
    {
      'service.name': collectorExporterBase.serviceName,
    }
  );
  return {
    resourceMetrics: toCollectorResourceMetrics(
      groupedMetrics,
      additionalAttributes,
      startTime
    ),
  };
}

/**
 * Takes an array of metrics and groups them by resource and instrumentation
 * library
 * @param metrics metrics
 */
export function groupMetricsByResourceAndLibrary(
  metrics: MetricRecord[]
): Map<Resource, Map<core.InstrumentationLibrary, MetricRecord[]>> {
  return metrics.reduce((metricMap, metric) => {
    //group by resource
    let resourceMetrics = metricMap.get(metric.resource);
    if (!resourceMetrics) {
      resourceMetrics = new Map<core.InstrumentationLibrary, MetricRecord[]>();
      metricMap.set(metric.resource, resourceMetrics);
    }
    //group by instrumentation library
    let libMetrics = resourceMetrics.get(metric.instrumentationLibrary);
    if (!libMetrics) {
      libMetrics = new Array<MetricRecord>();
      resourceMetrics.set(metric.instrumentationLibrary, libMetrics);
    }
    libMetrics.push(metric);
    return metricMap;
  }, new Map<Resource, Map<core.InstrumentationLibrary, MetricRecord[]>>());
}

/**
 * Convert to InstrumentationLibraryMetrics
 * @param instrumentationLibrary
 * @param metrics
 * @param startTime
 */
function toCollectorInstrumentationLibraryMetrics(
  instrumentationLibrary: core.InstrumentationLibrary,
  metrics: MetricRecord[],
  startTime: number
): opentelemetryProto.metrics.v1.InstrumentationLibraryMetrics {
  return {
    metrics: metrics.map(metric => toCollectorMetric(metric, startTime)),
    instrumentationLibrary,
  };
}

/**
 * Returns a list of resource metrics which will be exported to the collector
 * @param groupedSpans
 * @param baseAttributes
 */
function toCollectorResourceMetrics(
  groupedMetrics: Map<
    Resource,
    Map<core.InstrumentationLibrary, MetricRecord[]>
  >,
  baseAttributes: SpanAttributes,
  startTime: number
): opentelemetryProto.metrics.v1.ResourceMetrics[] {
  return Array.from(groupedMetrics, ([resource, libMetrics]) => {
    return {
      resource: toCollectorResource(resource, baseAttributes),
      instrumentationLibraryMetrics: Array.from(
        libMetrics,
        ([instrumentationLibrary, metrics]) =>
          toCollectorInstrumentationLibraryMetrics(
            instrumentationLibrary,
            metrics,
            startTime
          )
      ),
    };
  });
}
