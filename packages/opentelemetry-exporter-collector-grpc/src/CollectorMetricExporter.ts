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
  collectorTypes,
  toCollectorExportMetricServiceRequest,
} from '@opentelemetry/exporter-collector';
import { MetricRecord, MetricExporter } from '@opentelemetry/metrics';
import { CollectorExporterConfigNode, ServiceClientType } from './types';
import { CollectorExporterNodeBase } from './CollectorExporterNodeBase';
import { getEnv } from '@opentelemetry/core';
import { validateAndNormalizeUrl } from './util';

const DEFAULT_COLLECTOR_URL = 'localhost:4317';

/**
 * Collector Metric Exporter for Node
 */
export class CollectorMetricExporter
  extends CollectorExporterNodeBase<
    MetricRecord,
    collectorTypes.opentelemetryProto.collector.metrics.v1.ExportMetricsServiceRequest
  >
  implements MetricExporter {
  // Converts time to nanoseconds
  protected readonly _startTime = new Date().getTime() * 1000000;

  convert(
    metrics: MetricRecord[]
  ): collectorTypes.opentelemetryProto.collector.metrics.v1.ExportMetricsServiceRequest {
    return toCollectorExportMetricServiceRequest(
      metrics,
      this._startTime,
      this
    );
  }

  getDefaultUrl(config: CollectorExporterConfigNode) {
    return typeof config.url === 'string'
      ? validateAndNormalizeUrl(config.url)
      : getEnv().OTEL_EXPORTER_OTLP_METRICS_ENDPOINT.length > 0
      ? validateAndNormalizeUrl(getEnv().OTEL_EXPORTER_OTLP_METRICS_ENDPOINT)
      : getEnv().OTEL_EXPORTER_OTLP_ENDPOINT.length > 0
      ? validateAndNormalizeUrl(getEnv().OTEL_EXPORTER_OTLP_ENDPOINT)
      : DEFAULT_COLLECTOR_URL;
  }

  getServiceClientType() {
    return ServiceClientType.METRICS;
  }

  getServiceProtoPath(): string {
    return 'opentelemetry/proto/collector/metrics/v1/metrics_service.proto';
  }
}
