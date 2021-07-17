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
  context,
  ROOT_CONTEXT,
  SpanContext,
  SpanKind,
  TraceFlags,
} from '@opentelemetry/api';
import {
  ExportResultCode,
  loggingErrorHandler,
  setGlobalErrorHandler,
} from '@opentelemetry/core';
import * as assert from 'assert';
import * as sinon from 'sinon';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  Span,
} from '../../../src';
import { TestStackContextManager } from './TestStackContextManager';
import { TestTracingSpanExporter } from './TestTracingSpanExporter';

describe('SimpleSpanProcessor', () => {
  const provider = new BasicTracerProvider();
  const exporter = new InMemorySpanExporter();

  describe('constructor', () => {
    it('should create a SimpleSpanProcessor instance', () => {
      const processor = new SimpleSpanProcessor(exporter);
      assert.ok(processor instanceof SimpleSpanProcessor);
    });
  });

  describe('.onStart/.onEnd/.shutdown', () => {
    it('should handle span started and ended when SAMPLED', async () => {
      const processor = new SimpleSpanProcessor(exporter);
      const spanContext: SpanContext = {
        traceId: 'a3cda95b652f4a1592b449d5929fda1b',
        spanId: '5e0c63257de34c92',
        traceFlags: TraceFlags.SAMPLED,
      };
      const span = new Span(
        provider.getTracer('default'),
        ROOT_CONTEXT,
        'span-name',
        spanContext,
        SpanKind.CLIENT
      );
      processor.onStart(span);
      assert.strictEqual(exporter.getFinishedSpans().length, 0);

      processor.onEnd(span);
      assert.strictEqual(exporter.getFinishedSpans().length, 1);

      await processor.shutdown();
      assert.strictEqual(exporter.getFinishedSpans().length, 0);
    });

    it('should handle span started and ended when UNSAMPLED', async () => {
      const processor = new SimpleSpanProcessor(exporter);
      const spanContext: SpanContext = {
        traceId: 'a3cda95b652f4a1592b449d5929fda1b',
        spanId: '5e0c63257de34c92',
        traceFlags: TraceFlags.NONE,
      };
      const span = new Span(
        provider.getTracer('default'),
        ROOT_CONTEXT,
        'span-name',
        spanContext,
        SpanKind.CLIENT
      );
      processor.onStart(span);
      assert.strictEqual(exporter.getFinishedSpans().length, 0);

      processor.onEnd(span);
      assert.strictEqual(exporter.getFinishedSpans().length, 0);

      await processor.shutdown();
      assert.strictEqual(exporter.getFinishedSpans().length, 0);
    });

    it('should call globalErrorHandler when exporting fails', async () => {
      const expectedError = new Error('Exporter failed');
      const processor = new SimpleSpanProcessor(exporter);
      const spanContext: SpanContext = {
        traceId: 'a3cda95b652f4a1592b449d5929fda1b',
        spanId: '5e0c63257de34c92',
        traceFlags: TraceFlags.NONE,
      };
      const span = new Span(
        provider.getTracer('default'),
        ROOT_CONTEXT,
        'span-name',
        spanContext,
        SpanKind.CLIENT
      );

      sinon.stub(exporter, 'export').callsFake((_, callback) => {
        setTimeout(() => {
          callback({ code: ExportResultCode.FAILED, error: expectedError });
        }, 0);
      });

      const errorHandlerSpy = sinon.spy();

      setGlobalErrorHandler(errorHandlerSpy);

      processor.onEnd(span);

      await new Promise<void>(resolve => {
        setTimeout(() => {
          resolve();
        }, 0);
      });

      assert.strictEqual(errorHandlerSpy.callCount, 1);

      const [[error]] = errorHandlerSpy.args;

      assert.deepStrictEqual(error, expectedError);

      //reset global error handler
      setGlobalErrorHandler(loggingErrorHandler());
    });
  });

  describe('force flush', () => {
    describe('when flushing complete', () => {
      it('should call an async callback', done => {
        const processor = new SimpleSpanProcessor(exporter);
        processor.forceFlush().then(() => {
          done();
        });
      });
    });

    describe('when shutdown is complete', () => {
      it('should call an async callback', done => {
        const processor = new SimpleSpanProcessor(exporter);
        processor.shutdown().then(() => {
          done();
        });
      });
    });
  });

  describe('onEnd', () => {
    beforeEach(() => {
      const contextManager = new TestStackContextManager().enable();
      context.setGlobalContextManager(contextManager);
    });

    afterEach(() => {
      context.disable();
    });

    it('should prevent instrumentation prior to export', () => {
      const testTracingExporter = new TestTracingSpanExporter();
      const processor = new SimpleSpanProcessor(testTracingExporter);

      const spanContext: SpanContext = {
        traceId: 'a3cda95b652f4a1592b449d5929fda1b',
        spanId: '5e0c63257de34c92',
        traceFlags: TraceFlags.SAMPLED,
      };
      const span = new Span(
        provider.getTracer('default'),
        ROOT_CONTEXT,
        'span-name',
        spanContext,
        SpanKind.CLIENT
      );

      processor.onEnd(span);

      const exporterCreatedSpans = testTracingExporter.getExporterCreatedSpans();
      assert.equal(exporterCreatedSpans.length, 0);
    });
  });
});
