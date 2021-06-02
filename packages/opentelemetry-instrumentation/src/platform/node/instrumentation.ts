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

import * as types from '../../types';
import * as path from 'path';
import * as RequireInTheMiddle from 'require-in-the-middle';
import * as semver from 'semver';
import { InstrumentationAbstract } from '../../instrumentation';
import { InstrumentationModuleDefinition } from './types';
import { diag } from '@opentelemetry/api';

/**
 * Base abstract class for instrumenting node plugins
 */
export abstract class InstrumentationBase<T = any>
  extends InstrumentationAbstract
  implements types.Instrumentation {
  private _modules: InstrumentationModuleDefinition<T>[];
  private _hooks: RequireInTheMiddle.Hooked[] = [];
  private _enabled = false;

  constructor(
    instrumentationName: string,
    instrumentationVersion: string,
    config: types.InstrumentationConfig = {}
  ) {
    super(instrumentationName, instrumentationVersion, config);

    let modules = this.init();

    if (modules && !Array.isArray(modules)) {
      modules = [modules];
    }

    this._modules = (modules as InstrumentationModuleDefinition<T>[]) || [];

    if (this._modules.length === 0) {
      diag.warn(
        'No modules instrumentation has been defined,' +
          ' nothing will be patched'
      );
    }

    if (this._config.enabled) {
      this.enable();
    }
  }

  private _onRequire<T>(
    module: InstrumentationModuleDefinition<T>,
    exports: T,
    name: string,
    baseDir?: string
  ): T {
    if (!baseDir) {
      if (typeof module.patch === 'function') {
        module.moduleExports = exports;
        return module.patch(exports);
      }
      return exports;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const version = require(path.join(baseDir, 'package.json')).version;
    module.moduleVersion = version;
    if (module.name === name) {
      // main module
      if (
        typeof version === 'string' &&
        isSupported(module.supportedVersions, version)
      ) {
        if (typeof module.patch === 'function') {
          module.moduleExports = exports;
          if (this._enabled) {
            return module.patch(exports, module.moduleVersion);
          }
        }
      }
    } else {
      // internal file
      const files = module.files ?? [];
      const file = files.find(file => file.name === name);
      if (file && isSupported(file.supportedVersions, version)) {
        file.moduleExports = exports;
        if (this._enabled) {
          return file.patch(exports, module.moduleVersion);
        }
      }
    }
    return exports;
  }

  public enable() {
    if (this._enabled) {
      return;
    }
    this._enabled = true;

    // already hooked, just call patch again
    if (this._hooks.length > 0) {
      for (const module of this._modules) {
        if (typeof module.patch === 'function' && module.moduleExports) {
          module.patch(module.moduleExports, module.moduleVersion);
        }
        for (const file of module.files) {
          if (file.moduleExports) {
            file.patch(file.moduleExports, module.moduleVersion);
          }
        }
      }
      return;
    }

    for (const module of this._modules) {
      this._hooks.push(
        RequireInTheMiddle(
          [module.name],
          { internals: true },
          (exports, name, baseDir) => {
            return this._onRequire<typeof exports>(
              (module as unknown) as InstrumentationModuleDefinition<
                typeof exports
              >,
              exports,
              name,
              baseDir
            );
          }
        )
      );
    }
  }

  public disable() {
    if (!this._enabled) {
      return;
    }
    this._enabled = false;

    for (const module of this._modules) {
      if (typeof module.unpatch === 'function' && module.moduleExports) {
        module.unpatch(module.moduleExports, module.moduleVersion);
      }
      for (const file of module.files) {
        if (file.moduleExports) {
          file.unpatch(file.moduleExports, module.moduleVersion);
        }
      }
    }
  }

  public isEnabled() {
    return this._enabled;
  }
}

function isSupported(supportedVersions: string[], version: string): boolean {
  return supportedVersions.some(supportedVersion => {
    return semver.satisfies(version, supportedVersion);
  });
}
