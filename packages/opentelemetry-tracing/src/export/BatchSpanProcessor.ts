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

import { context } from '@opentelemetry/api';
import {
  ExportResultCode,
  getEnv,
  globalErrorHandler,
  suppressTracing,
  unrefTimer,
} from '@opentelemetry/core';
import { Span } from '../Span';
import { SpanProcessor } from '../SpanProcessor';
import { BufferConfig } from '../types';
import { ReadableSpan } from './ReadableSpan';
import { SpanExporter } from './SpanExporter';

/**
 * Implementation of the {@link SpanProcessor} that batches spans exported by
 * the SDK then pushes them to the exporter pipeline.
 */
export class BatchSpanProcessor implements SpanProcessor {
  private readonly _maxExportBatchSize: number;
  private readonly _maxQueueSize: number;
  private readonly _scheduledDelayMillis: number;
  private readonly _exportTimeoutMillis: number;

  private _finishedSpans: ReadableSpan[] = [];
  private _timer: NodeJS.Timeout | undefined;
  private _isShutdown = false;
  private _shuttingDownPromise: Promise<void> = Promise.resolve();

  constructor(private readonly _exporter: SpanExporter, config?: BufferConfig) {
    const env = getEnv();
    this._maxExportBatchSize =
      typeof config?.maxExportBatchSize === 'number'
        ? config.maxExportBatchSize
        : env.OTEL_BSP_MAX_EXPORT_BATCH_SIZE;
    this._maxQueueSize =
      typeof config?.maxQueueSize === 'number'
        ? config?.maxQueueSize
        : env.OTEL_BSP_MAX_QUEUE_SIZE;
    this._scheduledDelayMillis =
      typeof config?.scheduledDelayMillis === 'number'
        ? config?.scheduledDelayMillis
        : env.OTEL_BSP_SCHEDULE_DELAY;
    this._exportTimeoutMillis =
      typeof config?.exportTimeoutMillis === 'number'
        ? config?.exportTimeoutMillis
        : env.OTEL_BSP_EXPORT_TIMEOUT;
  }

  forceFlush(): Promise<void> {
    if (this._isShutdown) {
      return this._shuttingDownPromise;
    }
    return this._flushAll();
  }

  // does nothing.
  onStart(_span: Span): void {}

  onEnd(span: ReadableSpan): void {
    if (this._isShutdown) {
      return;
    }
    this._addToBuffer(span);
  }

  shutdown(): Promise<void> {
    if (this._isShutdown) {
      return this._shuttingDownPromise;
    }
    this._isShutdown = true;
    this._shuttingDownPromise = new Promise((resolve, reject) => {
      Promise.resolve()
        .then(() => {
          return this._flushAll();
        })
        .then(() => {
          return this._exporter.shutdown();
        })
        .then(resolve)
        .catch(e => {
          reject(e);
        });
    });
    return this._shuttingDownPromise;
  }

  /** Add a span in the buffer. */
  private _addToBuffer(span: ReadableSpan) {
    if (this._finishedSpans.length >= this._maxQueueSize) {
      // limit reached, drop span
      return;
    }
    this._finishedSpans.push(span);
    this._maybeStartTimer();
  }

  /**
   * Send all spans to the exporter respecting the batch size limit
   * This function is used only on forceFlush or shutdown,
   * for all other cases _flush should be used
   * */
  private _flushAll(): Promise<void> {
    return new Promise((resolve, reject) => {
      const promises = [];
      // calculate number of batches
      const count = Math.ceil(
        this._finishedSpans.length / this._maxExportBatchSize
      );
      for (let i = 0, j = count; i < j; i++) {
        promises.push(this._flushOneBatch());
      }
      Promise.all(promises)
        .then(() => {
          resolve();
        })
        .catch(reject);
    });
  }

  private _flushOneBatch(): Promise<void> {
    this._clearTimer();
    if (this._finishedSpans.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // don't wait anymore for export, this way the next batch can start
        reject(new Error('Timeout'));
      }, this._exportTimeoutMillis);
      // prevent downstream exporter calls from generating spans
      context.with(suppressTracing(context.active()), () => {
        // Reset the finished spans buffer here because the next invocations of the _flush method
        // could pass the same finished spans to the exporter if the buffer is cleared
        // outside of the execution of this callback.
        this._exporter.export(
          this._finishedSpans.splice(0, this._maxExportBatchSize),
          result => {
            clearTimeout(timer);
            if (result.code === ExportResultCode.SUCCESS) {
              resolve();
            } else {
              reject(
                result.error ??
                  new Error('BatchSpanProcessor: span export failed')
              );
            }
          }
        );
      });
    });
  }

  private _maybeStartTimer() {
    if (this._timer !== undefined) return;
    this._timer = setTimeout(() => {
      this._flushOneBatch()
        .then(() => {
          if (this._finishedSpans.length > 0) {
            this._clearTimer();
            this._maybeStartTimer();
          }
        })
        .catch(e => {
          globalErrorHandler(e);
        });
    }, this._scheduledDelayMillis);
    unrefTimer(this._timer);
  }

  private _clearTimer() {
    if (this._timer !== undefined) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
  }
}
