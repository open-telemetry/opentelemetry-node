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

import { Tracer, TracerProvider } from '@opentelemetry/api';
import { NOOP_METER_PROVIDER } from '@opentelemetry/api-metrics';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { InstrumentationBase, registerInstrumentations } from '../../src';

class DummyTracerProvider implements TracerProvider {
  getTracer(name: string, version?: string): Tracer {
    throw new Error("not implemented");
  }
}
class FooInstrumentation extends InstrumentationBase {
  init() {
    return [];
  }
  override enable() {}
  override disable() {}
}

describe('autoLoader', () => {
  let unload: Function | undefined;

  afterEach(() => {
    sinon.restore();
    if (typeof unload === 'function') {
      unload();
      unload = undefined;
    }
  });

  describe('registerInstrumentations', () => {
    describe('InstrumentationBase', () => {
      let instrumentation: InstrumentationBase;
      let enableSpy: sinon.SinonSpy;
      let setTracerProviderSpy: sinon.SinonSpy;
      let setsetMeterProvider: sinon.SinonSpy;
      const tracerProvider = new DummyTracerProvider();
      const meterProvider = NOOP_METER_PROVIDER;
      beforeEach(() => {
        instrumentation = new FooInstrumentation('foo', '1', {});
        enableSpy = sinon.spy(instrumentation, 'enable');
        setTracerProviderSpy = sinon.stub(instrumentation, 'setTracerProvider');
        setsetMeterProvider = sinon.stub(instrumentation, 'setMeterProvider');
        unload = registerInstrumentations({
          instrumentations: [instrumentation],
          tracerProvider,
          meterProvider,
        });
      });

      afterEach(() => {
        Object.keys(require.cache).forEach(key => delete require.cache[key]);
        if (typeof unload === 'function') {
          unload();
          unload = undefined;
        }
      });

      it('should enable instrumentation', () => {
        assert.strictEqual(enableSpy.callCount, 1);
      });

      it('should set TracerProvider', () => {
        assert.strictEqual(setTracerProviderSpy.callCount, 1);
        assert.ok(setTracerProviderSpy.lastCall.args[0] === tracerProvider);
        assert.strictEqual(setTracerProviderSpy.lastCall.args.length, 1);
      });

      it('should set MeterProvider', () => {
        assert.strictEqual(setsetMeterProvider.callCount, 1);
        assert.ok(setsetMeterProvider.lastCall.args[0] === meterProvider);
        assert.strictEqual(setsetMeterProvider.lastCall.args.length, 1);
      });
    });
  });
});
