/**
 * Copyright 2019, OpenTelemetry Authors
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

import * as assert from 'assert';
import {
  PluginLoader,
  HookState,
} from '../../src/instrumentation/PluginLoader';
import { NoopTracer, NoopLogger } from '@opentelemetry/core';

const INSTALLED_PLUGINS_PATH = `${__dirname}/node_modules`;
const TEST_MODULES = ['simple-module', 'nonexistent-module', 'http'];

const clearRequireCache = () => {
  Object.keys(require.cache).forEach(key => delete require.cache[key]);
};

describe('PluginLoader', () => {
  const tracer = new NoopTracer();
  const logger = new NoopLogger();

  before(() => {
    module.paths.push(INSTALLED_PLUGINS_PATH);
    PluginLoader.searchPathForTest = INSTALLED_PLUGINS_PATH;
  });

  afterEach(() => {
    clearRequireCache();
  });

  it('sanity check', () => {
    // Ensure that module fixtures contain values that we expect.
    const simpleModule = require(TEST_MODULES[0]);
    assert.strictEqual(simpleModule.name(), TEST_MODULES[0]);
    assert.strictEqual(simpleModule.value(), 0);
    assert.throws(() => require(TEST_MODULES[1]));
  });

  it('returns UNINITIALIZED when first called', () => {
    const pluginLoader = new PluginLoader(tracer, logger);
    assert.strictEqual(pluginLoader.state, HookState.UNINITIALIZED);
  });

  it('transitions from UNINITIALIZED to ENABLED', () => {
    const pluginLoader = new PluginLoader(tracer, logger);
    pluginLoader.loadPlugins([TEST_MODULES[0]]);
    assert.strictEqual(pluginLoader.state, HookState.ENABLED);
    pluginLoader.unloadPlugins();
  });

  it('transitions from ENABLED to DISABLED', () => {
    const pluginLoader = new PluginLoader(tracer, logger);
    pluginLoader.loadPlugins([TEST_MODULES[0]]).unloadPlugins();
    assert.strictEqual(pluginLoader.state, HookState.DISABLED);
  });

  it('throws if hook state is already ENABLED', () => {
    const pluginLoader = new PluginLoader(tracer, logger);
    pluginLoader.loadPlugins([TEST_MODULES[0]]);
    assert.throws(() => pluginLoader.loadPlugins([TEST_MODULES[0]]));
    pluginLoader.unloadPlugins();
  });

  it('patches modules when enabled', () => {
    const pluginLoader = new PluginLoader(tracer, console);
    assert.strictEqual(pluginLoader.plugins.length, 0);
    pluginLoader.loadPlugins(['simple-module']);
    // The hook is only called the first time the module is loaded.
    const simpleModule = require('simple-module');
    assert.strictEqual(pluginLoader.plugins.length, 1);
    assert.strictEqual(simpleModule.value(), 1);
    assert.strictEqual(simpleModule.name(), 'patched-simple-module');
    pluginLoader.unloadPlugins();
  });

  it('should not load a non existing plugin', () => {
    const pluginLoader = new PluginLoader(tracer, console);
    assert.strictEqual(pluginLoader.plugins.length, 0);
    pluginLoader.loadPlugins(['nonexistent-module']);
    assert.strictEqual(pluginLoader.plugins.length, 0);
    pluginLoader.unloadPlugins();
  });
});
