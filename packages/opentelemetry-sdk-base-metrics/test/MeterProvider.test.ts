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
import * as sinon from 'sinon';
import { MeterProvider, Meter, CounterMetric } from '../src';

describe('MeterProvider', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('should construct an instance without any options', () => {
      const provider = new MeterProvider();
      assert.ok(provider instanceof MeterProvider);
    });

    it('should construct an instance with logger', () => {
      const provider = new MeterProvider();
      assert.ok(provider instanceof MeterProvider);
    });
  });

  describe('getMeter', () => {
    it('should return an instance of Meter', () => {
      const meter = new MeterProvider().getMeter('test-meter-provider');
      assert.ok(meter instanceof Meter);
    });

    it('should propagate resources', () => {
      const meterProvider = new MeterProvider();
      const meter = meterProvider.getMeter('test-meter-provider');
      const counter = meter.createCounter('test-counter') as CounterMetric;
      assert.strictEqual((meter as any)._resource, meterProvider.resource);
      assert.strictEqual(counter.resource, meterProvider.resource);
    });

    it('should return the meter with default version without a version option', () => {
      const provider = new MeterProvider();
      const meter1 = provider.getMeter('default');
      const meter2 = provider.getMeter('default', undefined);
      assert.deepEqual(meter1, meter2);
    });

    it('should return the same Meter instance with same name & version', () => {
      const provider = new MeterProvider();
      const meter1 = provider.getMeter('meter1', 'ver1');
      const meter2 = provider.getMeter('meter1', 'ver1');
      assert.deepEqual(meter1, meter2);
    });

    it('should return different Meter instance with different name or version', () => {
      const provider = new MeterProvider();

      const meter1 = provider.getMeter('meter1', 'ver1');
      const meter2 = provider.getMeter('meter1');
      assert.notEqual(meter1, meter2);

      const meter3 = provider.getMeter('meter2', 'ver2');
      const meter4 = provider.getMeter('meter3', 'ver2');
      assert.notEqual(meter3, meter4);
    });
  });

  describe('shutdown()', () => {
    it('should call shutdown when manually invoked', () => {
      const meterProvider = new MeterProvider({
        interval: Math.pow(2, 31) - 1,
      });
      const shutdownStub1 = sinon.stub(
        meterProvider.getMeter('meter1'),
        'shutdown'
      );
      const shutdownStub2 = sinon.stub(
        meterProvider.getMeter('meter2'),
        'shutdown'
      );
      meterProvider.shutdown().then(() => {
        sinon.assert.calledOnce(shutdownStub1);
        sinon.assert.calledOnce(shutdownStub2);
      });
    });
  });
});
