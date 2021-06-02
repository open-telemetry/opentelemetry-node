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

import { ReadableSpan, SpanExporter } from '@opentelemetry/tracing';
import { CollectorExporterNodeBase } from './CollectorExporterNodeBase';
import {
  collectorTypes,
  toCollectorExportTraceServiceRequest,
} from '@opentelemetry/exporter-collector';
import { CollectorExporterConfigNode, ServiceClientType } from './types';
import { getEnv } from '@opentelemetry/core';
import { validateAndNormalizeUrl } from './util';

const DEFAULT_COLLECTOR_URL = 'localhost:4317';

/**
 * Collector Trace Exporter for Node
 */
export class CollectorTraceExporter
  extends CollectorExporterNodeBase<
    ReadableSpan,
    collectorTypes.opentelemetryProto.collector.trace.v1.ExportTraceServiceRequest
  >
  implements SpanExporter {
  convert(
    spans: ReadableSpan[]
  ): collectorTypes.opentelemetryProto.collector.trace.v1.ExportTraceServiceRequest {
    return toCollectorExportTraceServiceRequest(spans, this);
  }

  getDefaultUrl(config: CollectorExporterConfigNode) {
    return typeof config.url === 'string'
      ? validateAndNormalizeUrl(config.url)
      : getEnv().OTEL_EXPORTER_OTLP_TRACES_ENDPOINT.length > 0
      ? validateAndNormalizeUrl(getEnv().OTEL_EXPORTER_OTLP_TRACES_ENDPOINT)
      : getEnv().OTEL_EXPORTER_OTLP_ENDPOINT.length > 0
      ? validateAndNormalizeUrl(getEnv().OTEL_EXPORTER_OTLP_ENDPOINT)
      : DEFAULT_COLLECTOR_URL;
  }

  getServiceClientType() {
    return ServiceClientType.SPANS;
  }

  getServiceProtoPath(): string {
    return 'opentelemetry/proto/collector/trace/v1/trace_service.proto';
  }
}
