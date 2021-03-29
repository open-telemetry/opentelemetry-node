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

// This is copy from previous version, should be removed after plugins are gone

import { TracerProvider, diag } from '@opentelemetry/api';
import * as RequireInTheMiddle from 'require-in-the-middle';
import { OldClassPlugin, OldPluginConfig } from '../../../types_plugin_only';
import * as utils from './utils';
import { createRequire } from 'module';

const getPlugin = (modulePath: string, require: NodeRequire): OldClassPlugin => {
  try {
    return require(modulePath).plugin;
  } catch (e) {
    if (require !== mainRequire) {
      return getPlugin(modulePath, mainRequire);
    }
    throw e;
  }
};

const mainRequire = ((): NodeRequire  => {
  const mainFilename = require?.main?.filename;
  if (!mainFilename) {
    return require;
  }
  return createRequire(mainFilename);
})();

// States for the Plugin Loader
export enum HookState {
  UNINITIALIZED,
  ENABLED,
  DISABLED,
}

/**
 * Environment variable which will contain list of modules to not load corresponding plugins for
 * e.g.OTEL_NO_PATCH_MODULES=pg,https,mongodb
 */
export const ENV_PLUGIN_DISABLED_LIST = 'OTEL_NO_PATCH_MODULES';

/**
 * Wildcard symbol. If ignore list is set to this, disable all plugins
 */
const DISABLE_ALL_PLUGINS = '*';

export interface Plugins {
  [pluginName: string]: OldPluginConfig;
}

/**
 * Returns the Plugins object that meet the below conditions.
 * Valid criteria: 1. It should be enabled. 2. Should have non-empty path.
 */
function filterPlugins(plugins: Plugins): Plugins {
  const keys = Object.keys(plugins);
  return keys.reduce((acc: Plugins, key: string) => {
    if (plugins[key].enabled && (plugins[key].path || plugins[key].plugin)) {
      acc[key] = plugins[key];
    }
    return acc;
  }, {});
}

/**
 * Parse process.env[ENV_PLUGIN_DISABLED_LIST] for a list of modules
 * not to load corresponding plugins for.
 */
function getIgnoreList(): string[] | typeof DISABLE_ALL_PLUGINS {
  const envIgnoreList: string = process.env[ENV_PLUGIN_DISABLED_LIST] || '';
  if (envIgnoreList === DISABLE_ALL_PLUGINS) {
    return envIgnoreList;
  }
  return envIgnoreList.split(',').map(v => v.trim());
}

/**
 * The PluginLoader class can load instrumentation plugins that use a patch
 * mechanism to enable automatic tracing for specific target modules.
 */
export class PluginLoader {
  /** A list of loaded plugins. */
  plugins: OldClassPlugin[] = [];
  /**
   * A field that tracks whether the require-in-the-middle hook has been loaded
   * for the first time, as well as whether the hook body is activated or not.
   */
  private _hookState = HookState.UNINITIALIZED;

  /** Constructs a new PluginLoader instance. */
  constructor(readonly provider: TracerProvider) {}

  /**
   * Loads a list of plugins. Each plugin module should implement the core
   * {@link Plugin} interface and export an instance named as 'plugin'. This
   * function will attach a hook to be called the first time the module is
   * loaded.
   * @param Plugins an object whose keys are plugin names and whose
   *     {@link OldPluginConfig} values indicate several configuration options.
   */
  load(plugins: Plugins): PluginLoader {
    if (this._hookState === HookState.UNINITIALIZED) {
      const pluginsToLoad = filterPlugins(plugins);
      const modulesToHook = Object.keys(pluginsToLoad);
      const modulesToIgnore = getIgnoreList();
      // Do not hook require when no module is provided. In this case it is
      // not necessary. With skipping this step we lower our footprint in
      // customer applications and require-in-the-middle won't show up in CPU
      // frames.
      if (modulesToHook.length === 0) {
        this._hookState = HookState.DISABLED;
        return this;
      }

      const requiredModulesToHook = modulesToHook.filter((name: string) => {
        try {
          const moduleResolvedFilename = require.resolve(name);
          return moduleResolvedFilename in require.cache;
        } catch {
          return false;
        }
      });
      if (requiredModulesToHook.length > 0) {
        diag.warn(
          `Some modules (${requiredModulesToHook.join(
            ', '
          )}) were already required when their respective plugin was loaded, some plugins might not work. Make sure the SDK is setup before you require in other modules.`
        );
      }

      // Enable the require hook.
      RequireInTheMiddle(modulesToHook, (exports, name, baseDir) => {
        if (this._hookState !== HookState.ENABLED) return exports;
        const config = pluginsToLoad[name];
        const modulePath = config.path!;
        const modulePlugin = config.plugin;
        let version = null;

        if (!baseDir) {
          // basedir is the directory where the module is located,
          // or undefined for core modules.
          // lets plugins restrict what they support for core modules (see plugin.supportedVersions)
          version = process.versions.node;
        } else {
          // Get the module version.
          version = utils.getPackageVersion(baseDir);
        }

        // Skip loading of all modules if '*' is provided
        if (modulesToIgnore === DISABLE_ALL_PLUGINS) {
          diag.info(
            `PluginLoader#load: skipped patching module ${name} because all plugins are disabled (${ENV_PLUGIN_DISABLED_LIST})`
          );
          return exports;
        }

        if (modulesToIgnore.includes(name)) {
          diag.info(
            `PluginLoader#load: skipped patching module ${name} because it was on the ignore list (${ENV_PLUGIN_DISABLED_LIST})`
          );
          return exports;
        }

        diag.info(`PluginLoader#load: trying to load ${name}@${version}`);

        if (!version) return exports;

        diag.debug(
          `PluginLoader#load: applying patch to ${name}@${version} using ${modulePath} module`
        );

        // Expecting a plugin from module;
        try {
          const plugin: OldClassPlugin = modulePlugin ?? getPlugin(modulePath, require);
          if (!utils.isSupportedVersion(version, plugin.supportedVersions)) {
            diag.warn(
              `PluginLoader#load: Plugin ${name} only supports module ${plugin.moduleName} with the versions: ${plugin.supportedVersions}`
            );
            return exports;
          }
          if (plugin.moduleName !== name) {
            diag.error(
              `PluginLoader#load: Entry ${name} use a plugin that instruments ${plugin.moduleName}`
            );
            return exports;
          }

          this.plugins.push(plugin);
          // Enable each supported plugin.
          return plugin.enable(exports, this.provider, config);
        } catch (e) {
          diag.error(
            `PluginLoader#load: could not load plugin ${modulePath} of module ${name}. Error: ${e.message}`
          );
          return exports;
        }
      });
      this._hookState = HookState.ENABLED;
    } else if (this._hookState === HookState.DISABLED) {
      diag.error(
        'PluginLoader#load: Currently cannot re-enable plugin loader.'
      );
    } else {
      diag.error('PluginLoader#load: Plugin loader already enabled.');
    }
    return this;
  }

  /** Unloads plugins. */
  unload(): PluginLoader {
    if (this._hookState === HookState.ENABLED) {
      for (const plugin of this.plugins) {
        plugin.disable();
      }
      this.plugins = [];
      this._hookState = HookState.DISABLED;
    }
    return this;
  }
}

/**
 * Adds a search path for plugin modules. Intended for testing purposes only.
 * @param searchPath The path to add.
 */
export function searchPathForTest(searchPath: string) {
  module.paths.push(searchPath);
}
