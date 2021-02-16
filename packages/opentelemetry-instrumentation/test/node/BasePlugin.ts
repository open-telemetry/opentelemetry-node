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

import { Logger, TracerProvider } from '@opentelemetry/api';
import { OldClassPlugin, OldPluginConfig } from '../../src/types_plugin_only';

/** This class represent the base to patch plugin. */
export abstract class BasePlugin<T> implements OldClassPlugin<T> {
  abstract readonly moduleName: string; // required for internalFilesExports
  protected _moduleExports!: T;
  constructor(
    protected readonly _tracerName: string,
    protected readonly _tracerVersion?: string
  ) {}

  enable(
    moduleExports: T,
    _tracerProvider: TracerProvider,
    _logger: Logger,
    _config?: OldPluginConfig
  ): T {
    this._moduleExports = moduleExports;
    return this.patch();
  }

  disable(): void {
    this.unpatch();
  }

  protected abstract patch(): T;
  protected abstract unpatch(): void;
}
