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
  CollectorExporterNodeConfigBase,
} from '@opentelemetry/exporter-collector';
import { ServiceClientType } from './types';

const DEFAULT_SERVICE_NAME = 'collector-trace-exporter';
const DEFAULT_COLLECTOR_URL = 'http://localhost:55681/v1/trace';

/**
 * Collector Trace Exporter for Node with protobuf
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
    return toCollectorExportTraceServiceRequest(
      spans,
      this.serviceName,
      this.attributes
    );
  }

  getDefaultUrl(config: CollectorExporterNodeConfigBase): string {
    if (!config.url) {
      return DEFAULT_COLLECTOR_URL;
    }
    return config.url;
  }

  getDefaultServiceName(config: CollectorExporterNodeConfigBase): string {
    return config.serviceName || DEFAULT_SERVICE_NAME;
  }

  getServiceClientType() {
    return ServiceClientType.SPANS;
  }
}
