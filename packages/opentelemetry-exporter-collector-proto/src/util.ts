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
  sendWithHttp,
  CollectorExporterNodeConfigBase,
  CompressionAlgorithm,
} from '@opentelemetry/exporter-collector';
import * as path from 'path';

import { ServiceClientType } from './types';
import { CollectorExporterNodeBase } from './CollectorExporterNodeBase';
import type { Type } from 'protobufjs';
import * as protobufjs from 'protobufjs';

let ExportRequestProto: Type | undefined;

export function getExportRequestProto(): Type | undefined {
  return ExportRequestProto;
}

export function onInit<ExportItem, ServiceRequest>(
  collector: CollectorExporterNodeBase<ExportItem, ServiceRequest>,
  _config: CollectorExporterNodeConfigBase
): void {
  const dir = path.resolve(__dirname, '..', 'protos');
  const root = new protobufjs.Root();
  root.resolvePath = function (origin, target) {
    return `${dir}/${target}`;
  };
  if (collector.getServiceClientType() === ServiceClientType.SPANS) {
    const proto = root.loadSync([
      'opentelemetry/proto/common/v1/common.proto',
      'opentelemetry/proto/resource/v1/resource.proto',
      'opentelemetry/proto/trace/v1/trace.proto',
      'opentelemetry/proto/collector/trace/v1/trace_service.proto',
    ]);
    ExportRequestProto = proto?.lookupType('ExportTraceServiceRequest');
  } else {
    const proto = root.loadSync([
      'opentelemetry/proto/common/v1/common.proto',
      'opentelemetry/proto/resource/v1/resource.proto',
      'opentelemetry/proto/metrics/v1/metrics.proto',
      'opentelemetry/proto/collector/metrics/v1/metrics_service.proto',
    ]);
    ExportRequestProto = proto?.lookupType('ExportMetricsServiceRequest');
  }
}

export function send<ExportItem, ServiceRequest>(
  collector: CollectorExporterNodeBase<ExportItem, ServiceRequest>,
  objects: ExportItem[],
  compression: CompressionAlgorithm,
  onSuccess: () => void,
  onError: (error: collectorTypes.CollectorExporterError) => void
): void {
  const serviceRequest = collector.convert(objects);

  const message = getExportRequestProto()?.create(serviceRequest);
  if (message) {
    const body = getExportRequestProto()?.encode(message).finish();
    if (body) {
      sendWithHttp(
        collector,
        Buffer.from(body),
        'application/x-protobuf',
        onSuccess,
        onError
      );
    }
  } else {
    onError(new collectorTypes.CollectorExporterError('No proto'));
  }
}
