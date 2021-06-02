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

import { SpanAttributes, diag } from '@opentelemetry/api';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import {
  CollectorExporterError,
  CollectorExporterConfigBase,
  ExportServiceError,
} from './types';

/**
 * Collector Exporter abstract base class
 */
export abstract class CollectorExporterBase<
  T extends CollectorExporterConfigBase,
  ExportItem,
  ServiceRequest
> {
  public readonly url: string;
  public readonly hostname: string | undefined;
  public readonly attributes?: SpanAttributes;
  protected _concurrencyLimit: number;
  protected _isShutdown: boolean = false;
  private _shuttingDownPromise: Promise<void> = Promise.resolve();
  protected _sendingPromises: Promise<unknown>[] = [];

  /**
   * @param config
   */
  constructor(config: T = {} as T) {
    this.url = this.getDefaultUrl(config);
    if (typeof config.hostname === 'string') {
      this.hostname = config.hostname;
    }

    this.attributes = config.attributes;

    this.shutdown = this.shutdown.bind(this);

    this._concurrencyLimit =
      typeof config.concurrencyLimit === 'number'
        ? config.concurrencyLimit
        : Infinity;

    // platform dependent
    this.onInit(config);
  }

  /**
   * Export items.
   * @param items
   * @param resultCallback
   */
  export(items: ExportItem[], resultCallback: (result: ExportResult) => void) {
    if (this._isShutdown) {
      resultCallback({
        code: ExportResultCode.FAILED,
        error: new Error('Exporter has been shutdown'),
      });
      return;
    }

    if (this._sendingPromises.length >= this._concurrencyLimit) {
      resultCallback({
        code: ExportResultCode.FAILED,
        error: new Error('Concurrent export limit reached'),
      });
      return;
    }

    this._export(items)
      .then(() => {
        resultCallback({ code: ExportResultCode.SUCCESS });
      })
      .catch((error: ExportServiceError) => {
        resultCallback({ code: ExportResultCode.FAILED, error });
      });
  }

  private _export(items: ExportItem[]): Promise<unknown> {
    return new Promise<void>((resolve, reject) => {
      try {
        diag.debug('items to be sent', items);
        this.send(items, resolve, reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Shutdown the exporter.
   */
  shutdown(): Promise<void> {
    if (this._isShutdown) {
      diag.debug('shutdown already started');
      return this._shuttingDownPromise;
    }
    this._isShutdown = true;
    diag.debug('shutdown started');
    this._shuttingDownPromise = new Promise((resolve, reject) => {
      Promise.resolve()
        .then(() => {
          return this.onShutdown();
        })
        .then(() => {
          return Promise.all(this._sendingPromises);
        })
        .then(() => {
          resolve();
        })
        .catch(e => {
          reject(e);
        });
    });
    return this._shuttingDownPromise;
  }

  abstract onShutdown(): void;
  abstract onInit(config: T): void;
  abstract send(
    items: ExportItem[],
    onSuccess: () => void,
    onError: (error: CollectorExporterError) => void
  ): void;
  abstract getDefaultUrl(config: T): string;
  abstract convert(objects: ExportItem[]): ServiceRequest;
}
