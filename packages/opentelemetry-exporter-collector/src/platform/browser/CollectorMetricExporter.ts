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

import { MetricRecord, MetricExporter } from '@opentelemetry/metrics';
import { CollectorExporterConfigBase } from '../../types';
import * as collectorTypes from '../../types';
import { CollectorExporterBrowserBase } from './CollectorExporterBrowserBase';
import { toCollectorExportMetricServiceRequest } from '../../transformMetrics';
import { getEnv, baggageUtils } from '@opentelemetry/core';

const DEFAULT_COLLECTOR_URL = 'http://localhost:55681/v1/metrics';

/**
 * Collector Metric Exporter for Web
 */
export class CollectorMetricExporter
  extends CollectorExporterBrowserBase<
    MetricRecord,
    collectorTypes.opentelemetryProto.collector.metrics.v1.ExportMetricsServiceRequest
  >
  implements MetricExporter {
  // Converts time to nanoseconds
  private readonly _startTime = new Date().getTime() * 1000000;

  constructor(config: CollectorExporterConfigBase = {}) {
    super(config);
    this._headers = Object.assign(
      this._headers,
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

  getDefaultUrl(config: CollectorExporterConfigBase) {
    return typeof config.url === 'string'
      ? config.url
      : getEnv().OTEL_EXPORTER_OTLP_METRICS_ENDPOINT.length > 0
      ? getEnv().OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
      : getEnv().OTEL_EXPORTER_OTLP_ENDPOINT.length > 0
      ? getEnv().OTEL_EXPORTER_OTLP_ENDPOINT
      : DEFAULT_COLLECTOR_URL;
  }
}
