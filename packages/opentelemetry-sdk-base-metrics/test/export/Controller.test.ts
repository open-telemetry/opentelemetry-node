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
import { MeterProvider, MetricExporter, MetricRecord } from '../../src';
import {
  ExportResult,
  ExportResultCode,
  setGlobalErrorHandler,
} from '@opentelemetry/core';

class MockExporter implements MetricExporter {
  constructor(private _result: ExportResult) {}

  export(
    metrics: MetricRecord[],
    resultCallback: (result: ExportResult) => void
  ): void {
    return resultCallback(this._result);
  }

  shutdown() {
    return Promise.resolve();
  }
}

describe('Controller', () => {
  describe('._collect()', () => {
    it('should use globalErrorHandler in case of error', done => {
      const errorHandlerSpy = sinon.spy();
      setGlobalErrorHandler(errorHandlerSpy);
      const expectedError = new Error('Failed to export');
      const meter = new MeterProvider({
        exporter: new MockExporter({
          code: ExportResultCode.FAILED,
          error: expectedError,
        }),
      }).getMeter('test-console-metric-exporter');
      const counter = meter
        .createCounter('counter', {
          description: 'a test description',
        })
        .bind({});
      counter.add(10);

      // @ts-expect-error trigger the collection from the controller
      meter._controller._collect();
      // wait for result
      setTimeout(() => {
        assert.deepStrictEqual(
          errorHandlerSpy.args[0][0].message,
          expectedError.message
        );
        setGlobalErrorHandler(() => {});
        return done();
      }, 0);
    });
  });
});
