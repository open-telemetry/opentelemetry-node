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
  NOOP_TRACER,
  NoopTracerProvider,
  createNoopDiagLogger,
} from '@opentelemetry/api';
import * as assert from 'assert';
import { BasePlugin } from '../../../src';

const provider = new NoopTracerProvider();
const diagLogger = createNoopDiagLogger();
describe('BasePlugin', () => {
  describe('enable', () => {
    it('should enable plugin', () => {
      const moduleExports = { foo: function () {} };
      const plugin = new TestPlugin('foo', '1');
      const patch = plugin.enable(moduleExports, provider, diagLogger);

      assert.strictEqual(plugin['_tracer'], NOOP_TRACER);
      assert.strictEqual(plugin['_tracerName'], 'foo');
      assert.strictEqual(plugin['_tracerVersion'], '1');
      assert.strictEqual(plugin['_diagLogger'], diagLogger);
      assert.strictEqual(patch, moduleExports);
    });
  });
});

class TestPlugin extends BasePlugin<{ [key: string]: Function }> {
  readonly moduleName = 'test-package';
  readonly version = '0.1.0';

  patch(): { [key: string]: Function } {
    return this._moduleExports;
  }

  protected unpatch(): void {}
}
