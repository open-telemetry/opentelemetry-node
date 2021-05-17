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
  CollectorExporterNodeConfigBase,
} from '@opentelemetry/exporter-collector';
import { MetricRecord, MetricExporter } from '@opentelemetry/metrics';
import { ServiceClientType } from './types';
import { CollectorExporterNodeBase } from './CollectorExporterNodeBase';
import { getEnv, baggageUtils } from '@opentelemetry/core';

const DEFAULT_SERVICE_NAME = 'collector-metric-exporter';
const DEFAULT_COLLECTOR_URL = 'http://localhost:4317/v1/metrics';

/**
 * Collector Metric Exporter for Node with protobuf
 */
export class CollectorMetricExporter
  extends CollectorExporterNodeBase<
    MetricRecord,
    collectorTypes.opentelemetryProto.collector.metrics.v1.ExportMetricsServiceRequest
  >
  implements MetricExporter {
  // Converts time to nanoseconds
  protected readonly _startTime = new Date().getTime() * 1000000;

  constructor(config: CollectorExporterNodeConfigBase = {}) {
    super(config);
    this.headers = Object.assign(
      this.headers,
      baggageUtils.parseKeyPairsIntoRecord(
        getEnv().OTEL_EXPORTER_OTLP_METRICS_HEADERS
      )
    );
  }

  convert(
    metrics: MetricRecord[]
  ): collectorTypes.opentelemetryProto.collector.metrics.v1.ExportMetricsServiceRequest {
    return toCollectorExportMetricServiceRequest(
      metrics,
      this._startTime,
      this
    );
  }

  getDefaultUrl(config: CollectorExporterNodeConfigBase) {
    return typeof config.url === 'string'
      ? config.url
      : getEnv().OTEL_EXPORTER_OTLP_METRICS_ENDPOINT.length > 0
      ? getEnv().OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
      : getEnv().OTEL_EXPORTER_OTLP_ENDPOINT.length > 0
      ? getEnv().OTEL_EXPORTER_OTLP_ENDPOINT
      : DEFAULT_COLLECTOR_URL;
  }

  getDefaultServiceName(config: CollectorExporterNodeConfigBase): string {
    return config.serviceName || DEFAULT_SERVICE_NAME;
  }

  getServiceClientType() {
    return ServiceClientType.METRICS;
  }
}
