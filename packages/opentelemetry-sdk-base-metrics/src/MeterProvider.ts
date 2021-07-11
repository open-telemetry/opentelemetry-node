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

import * as api from '@opentelemetry/api-metrics';
import { Resource } from '@opentelemetry/resources';
import { Meter } from '.';
import { DEFAULT_CONFIG, MeterConfig } from './types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const merge = require('lodash.merge');

/**
 * This class represents a meter provider which platform libraries can extend
 */
export class MeterProvider implements api.MeterProvider {
  private readonly _config: MeterConfig;
  private readonly _meters: Map<string, Meter> = new Map();
  private _shuttingDownPromise: Promise<void> = Promise.resolve();
  private _isShutdown = false;
  readonly resource: Resource;

  constructor(config: MeterConfig = {}) {
    const mergedConfig = merge({}, DEFAULT_CONFIG, config);
    this.resource = mergedConfig.resource || Resource.empty();
    this.resource = Resource.default().merge(this.resource);
    this._config = Object.assign({}, mergedConfig, {
      resource: this.resource,
    });
  }

  /**
   * Returns a Meter, creating one if one with the given name and version is not already created
   *
   * @returns Meter A Meter with the given name and version
   */
  getMeter(name: string, version?: string, config?: MeterConfig): Meter {
    const key = `${name}@${version || ''}`;
    if (!this._meters.has(key)) {
      this._meters.set(
        key,
        new Meter({ name, version }, config || this._config)
      );
    }

    return this._meters.get(key)!;
  }

  shutdown(): Promise<void> {
    if (this._isShutdown) {
      return this._shuttingDownPromise;
    }
    this._isShutdown = true;

    this._shuttingDownPromise = new Promise((resolve, reject) => {
      Promise.resolve()
        .then(() => {
          return Promise.all(
            Array.from(this._meters, ([_, meter]) => meter.shutdown())
          );
        })
        .then(() => {
          if (this._config.exporter) {
            return this._config.exporter.shutdown();
          }
          return;
        })
        .then(resolve)
        .catch(e => {
          reject(e);
        });
    });
    return this._shuttingDownPromise;
  }
}
