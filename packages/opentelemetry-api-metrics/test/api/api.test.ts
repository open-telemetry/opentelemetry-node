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

import * as assert from 'assert';
import { metrics, NoopMeter, NoopMeterProvider } from '../../src';

describe('API', () => {
  it('should expose a meter provider via getMeterProvider', () => {
    const meter = metrics.getMeterProvider();
    assert.ok(meter);
    assert.strictEqual(typeof meter, 'object');
  });

  describe('GlobalMeterProvider', () => {
    const dummyMeter = new NoopMeter();

    beforeEach(() => {
      metrics.disable();
    });

    it('should use the global meter provider', () => {
      metrics.setGlobalMeterProvider(new TestMeterProvider());
      const meter = metrics.getMeterProvider().getMeter('name');
      assert.deepStrictEqual(meter, dummyMeter);
    });

    class TestMeterProvider extends NoopMeterProvider {
      override getMeter() {
        return dummyMeter;
      }
    }
  });
});
