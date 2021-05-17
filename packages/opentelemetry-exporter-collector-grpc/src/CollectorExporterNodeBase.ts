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

import { diag } from '@opentelemetry/api';
import {
  CollectorExporterBase,
  collectorTypes,
} from '@opentelemetry/exporter-collector';
import type { Metadata } from '@grpc/grpc-js';
import {
  CollectorExporterConfigNode,
  GRPCQueueItem,
  ServiceClientType,
} from './types';
import { ServiceClient } from './types';
import { validateAndNormalizeUrl } from './util';

/**
 * Collector Metric Exporter abstract base class
 */
export abstract class CollectorExporterNodeBase<
  ExportItem,
  ServiceRequest
> extends CollectorExporterBase<
  CollectorExporterConfigNode,
  ExportItem,
  ServiceRequest
> {
  grpcQueue: GRPCQueueItem<ExportItem>[] = [];
  metadata?: Metadata;
  serviceClient?: ServiceClient = undefined;
  serverAddress: string;
  private _send!: Function;

  constructor(config: CollectorExporterConfigNode = {}) {
    super(config);
    if (config.headers) {
      diag.warn('Headers cannot be set when using grpc');
    }

    this.serverAddress = validateAndNormalizeUrl(this.url);
    this.metadata = config.metadata;
  }
  private _sendPromise(
    objects: ExportItem[],
    onSuccess: () => void,
    onError: (error: collectorTypes.CollectorExporterError) => void
  ): void {
    const promise = new Promise<void>(resolve => {
      const _onSuccess = (): void => {
        onSuccess();
        _onFinish();
      };
      const _onError = (error: collectorTypes.CollectorExporterError): void => {
        onError(error);
        _onFinish();
      };
      const _onFinish = () => {
        resolve();
        const index = this._sendingPromises.indexOf(promise);
        this._sendingPromises.splice(index, 1);
      };

      this._send(this, objects, _onSuccess, _onError);
    });

    this._sendingPromises.push(promise);
  }

  onInit(config: CollectorExporterConfigNode): void {
    this._isShutdown = false;
    // defer to next tick and lazy load to avoid loading grpc too early
    // and making this impossible to be instrumented
    setImmediate(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { onInit } = require('./util');
      onInit(this, config);
    });
  }

  send(
    objects: ExportItem[],
    onSuccess: () => void,
    onError: (error: collectorTypes.CollectorExporterError) => void
  ): void {
    if (this._isShutdown) {
      diag.debug('Shutdown already started. Cannot send objects');
      return;
    }
    if (!this._send) {
      // defer to next tick and lazy load to avoid loading grpc too early
      // and making this impossible to be instrumented
      setImmediate(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { send } = require('./util');
        this._send = send;

        this._sendPromise(objects, onSuccess, onError);
      });
    } else {
      this._sendPromise(objects, onSuccess, onError);
    }
  }

  onShutdown(): void {
    this._isShutdown = true;
    if (this.serviceClient) {
      this.serviceClient.close();
    }
  }

  abstract getServiceProtoPath(): string;
  abstract getServiceClientType(): ServiceClientType;
}
