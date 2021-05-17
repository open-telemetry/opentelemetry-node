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

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { diag } from '@opentelemetry/api';
import { globalErrorHandler } from '@opentelemetry/core';
import { collectorTypes } from '@opentelemetry/exporter-collector';
import * as path from 'path';
import { CollectorExporterNodeBase } from './CollectorExporterNodeBase';
import { URL } from 'url';
import {
  CollectorExporterConfigNode,
  GRPCQueueItem,
  ServiceClientType,
} from './types';

export function onInit<ExportItem, ServiceRequest>(
  collector: CollectorExporterNodeBase<ExportItem, ServiceRequest>,
  config: CollectorExporterConfigNode
): void {
  collector.grpcQueue = [];
  const credentials: grpc.ChannelCredentials =
    config.credentials || grpc.credentials.createInsecure();

  const includeDirs = [path.resolve(__dirname, '..', 'protos')];

  protoLoader
    .load(collector.getServiceProtoPath(), {
      keepCase: false,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs,
    })
    .then(packageDefinition => {
      const packageObject: any = grpc.loadPackageDefinition(packageDefinition);

      if (collector.getServiceClientType() === ServiceClientType.SPANS) {
        collector.serviceClient = new packageObject.opentelemetry.proto.collector.trace.v1.TraceService(
          collector.serverAddress,
          credentials
        );
      } else {
        collector.serviceClient = new packageObject.opentelemetry.proto.collector.metrics.v1.MetricsService(
          collector.serverAddress,
          credentials
        );
      }

      if (collector.grpcQueue.length > 0) {
        const queue = collector.grpcQueue.splice(0);
        queue.forEach((item: GRPCQueueItem<ExportItem>) => {
          collector.send(item.objects, item.onSuccess, item.onError);
        });
      }
    })
    .catch(err => {
      globalErrorHandler(err);
    });
}

export function send<ExportItem, ServiceRequest>(
  collector: CollectorExporterNodeBase<ExportItem, ServiceRequest>,
  objects: ExportItem[],
  onSuccess: () => void,
  onError: (error: collectorTypes.CollectorExporterError) => void
): void {
  if (collector.serviceClient) {
    const serviceRequest = collector.convert(objects);

    collector.serviceClient.export(
      serviceRequest,
      collector.metadata || new grpc.Metadata(),
      (err: collectorTypes.ExportServiceError) => {
        if (err) {
          diag.error('Service request', serviceRequest);
          onError(err);
        } else {
          diag.debug('Objects sent');
          onSuccess();
        }
      }
    );
  } else {
    collector.grpcQueue.push({
      objects,
      onSuccess,
      onError,
    });
  }
}

export function validateAndNormalizeUrl(url: string): string {
  const target = new URL(url);
  if (target.pathname !== '/') {
    diag.warn(
      'URL path should not be set when using grpc, the path part of the URL will be ignored.'
    );
  }
  if (target.protocol !== '' && !target.protocol?.match(/(http|grpc)s?/)) {
    diag.warn(
      'URL protocol should be http(s):// or grpc(s)://. Using grpc://.'
    );
  }
  return target.host;
}
