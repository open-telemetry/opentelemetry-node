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
  ExportResultCode,
  unrefTimer,
  globalErrorHandler,
} from '@opentelemetry/core';
import { Meter } from '../Meter';
import { MetricExporter } from './types';

const DEFAULT_EXPORT_INTERVAL = 60_000;

export class Controller {}

/** Controller organizes a periodic push of metric data. */
export class PushController extends Controller {
  private _timer: NodeJS.Timeout;

  constructor(
    private readonly _meter: Meter,
    private readonly _exporter: MetricExporter,
    interval: number = DEFAULT_EXPORT_INTERVAL
  ) {
    super();
    this._timer = setInterval(() => {
      this._collect().catch(err => {
        globalErrorHandler(err);
      });
    }, interval);
    unrefTimer(this._timer);
  }

  shutdown(): Promise<void> {
    clearInterval(this._timer);
    return this._collect();
  }

  private async _collect(): Promise<void> {
    await this._meter.collect();
    return new Promise(resolve => {
      this._exporter.export(
        this._meter.getProcessor().checkPointSet(),
        result => {
          if (result.code !== ExportResultCode.SUCCESS) {
            globalErrorHandler(
              result.error ??
                new Error('PushController: export failed in _collect')
            );
          }
          resolve();
        }
      );
    });
  }
}
