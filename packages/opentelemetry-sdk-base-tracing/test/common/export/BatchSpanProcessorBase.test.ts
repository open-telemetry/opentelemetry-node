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

import { diag } from '@opentelemetry/api';
import {
  AlwaysOnSampler,
  ExportResultCode,
  loggingErrorHandler,
  setGlobalErrorHandler,
} from '@opentelemetry/core';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { BasicTracerProvider, BufferConfig, InMemorySpanExporter, Span } from '../../../src';
import { context } from '@opentelemetry/api';
import { TestTracingSpanExporter } from './TestTracingSpanExporter';
import { TestStackContextManager } from './TestStackContextManager';
import { BatchSpanProcessorBase } from '../../../src/export/BatchSpanProcessorBase';

function createSampledSpan(spanName: string): Span {
  const tracer = new BasicTracerProvider({
    sampler: new AlwaysOnSampler(),
  }).getTracer('default');
  const span = tracer.startSpan(spanName);
  span.end();
  return span as Span;
}

class BatchSpanProcessor extends BatchSpanProcessorBase<BufferConfig> {
  onInit() {}
  onShutdown() {}
}

describe('BatchSpanProcessorBase', () => {
  const name = 'span-name';
  const defaultBufferConfig = {
    maxExportBatchSize: 5,
    scheduledDelayMillis: 2500,
  };
  let exporter: InMemorySpanExporter;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
  });

  afterEach(() => {
    exporter.reset();
    sinon.restore();
  });

  describe('constructor', () => {
    it('should create a BatchSpanProcessor instance', () => {
      const processor = new BatchSpanProcessor(exporter);
      assert.ok(processor instanceof BatchSpanProcessor);
      processor.shutdown();
    });

    it('should create a BatchSpanProcessor instance with config', () => {
      const processor = new BatchSpanProcessor(exporter, defaultBufferConfig);
      assert.ok(processor instanceof BatchSpanProcessor);
      processor.shutdown();
    });

    it('should create a BatchSpanProcessor instance with empty config', () => {
      const processor = new BatchSpanProcessor(exporter, {});
      assert.ok(processor instanceof BatchSpanProcessor);
      processor.shutdown();
    });

    it('should read defaults from environment', () => {
      const bspConfig = {
        OTEL_BSP_MAX_EXPORT_BATCH_SIZE: 256,
        OTEL_BSP_SCHEDULE_DELAY: 2500,
      };

      let env: Record<string, any>;
      if (typeof process === 'undefined') {
        env = (window as unknown) as Record<string, any>;
      } else {
        env = process.env as Record<string, any>;
      }

      Object.entries(bspConfig).forEach(([k, v]) => {
        env[k] = v;
      });

      const processor = new BatchSpanProcessor(exporter);
      assert.ok(processor instanceof BatchSpanProcessor);
      assert.strictEqual(processor['_maxExportBatchSize'], 256);
      assert.strictEqual(processor['_scheduledDelayMillis'], 2500);
      processor.shutdown();

      Object.keys(bspConfig).forEach(k => delete env[k]);
    });
  });

  describe('.onStart/.onEnd/.shutdown', () => {
    it('should call onShutdown', async () => {
      const processor = new BatchSpanProcessor(exporter, defaultBufferConfig);
      const onShutdownSpy = sinon.stub(processor, 'onShutdown');
      assert.strictEqual(onShutdownSpy.callCount, 0);
      await processor.shutdown();
      assert.strictEqual(onShutdownSpy.callCount, 1);
    });

    it('should do nothing after processor is shutdown', async () => {
      const processor = new BatchSpanProcessor(exporter, defaultBufferConfig);
      const spy: sinon.SinonSpy = sinon.spy(exporter, 'export') as any;

      const span = createSampledSpan(`${name}_0`);

      processor.onEnd(span);
      assert.strictEqual(processor['_finishedSpans'].length, 1);

      await processor.forceFlush();
      assert.strictEqual(exporter.getFinishedSpans().length, 1);

      processor.onEnd(span);
      assert.strictEqual(processor['_finishedSpans'].length, 1);

      assert.strictEqual(spy.args.length, 1);
      await processor.shutdown();
      assert.strictEqual(spy.args.length, 2);
      assert.strictEqual(exporter.getFinishedSpans().length, 0);

      processor.onEnd(span);
      assert.strictEqual(spy.args.length, 2);
      assert.strictEqual(processor['_finishedSpans'].length, 0);
      assert.strictEqual(exporter.getFinishedSpans().length, 0);
    });

    it('should export the sampled spans with buffer size reached', done => {
      const clock = sinon.useFakeTimers();
      const processor = new BatchSpanProcessor(exporter, defaultBufferConfig);
      for (let i = 0; i < defaultBufferConfig.maxExportBatchSize; i++) {
        const span = createSampledSpan(`${name}_${i}`);
        processor.onStart(span);
        assert.strictEqual(exporter.getFinishedSpans().length, 0);

        processor.onEnd(span);
        assert.strictEqual(exporter.getFinishedSpans().length, 0);
      }
      const span = createSampledSpan(`${name}_6`);
      processor.onEnd(span);

      setTimeout(async () => {
        assert.strictEqual(exporter.getFinishedSpans().length, 5);
        await processor.shutdown();
        assert.strictEqual(exporter.getFinishedSpans().length, 0);
        done();
      }, defaultBufferConfig.scheduledDelayMillis + 1000);
      clock.tick(defaultBufferConfig.scheduledDelayMillis + 1000);
      clock.restore();
    });

    it('should force flush when timeout exceeded', done => {
      const clock = sinon.useFakeTimers();
      const processor = new BatchSpanProcessor(exporter, defaultBufferConfig);
      for (let i = 0; i < defaultBufferConfig.maxExportBatchSize; i++) {
        const span = createSampledSpan(`${name}_${i}`);
        processor.onEnd(span);
        assert.strictEqual(exporter.getFinishedSpans().length, 0);
      }

      setTimeout(() => {
        assert.strictEqual(exporter.getFinishedSpans().length, 5);
        done();
      }, defaultBufferConfig.scheduledDelayMillis + 1000);

      clock.tick(defaultBufferConfig.scheduledDelayMillis + 1000);

      clock.restore();
    });

    it('should force flush on demand', () => {
      const processor = new BatchSpanProcessor(exporter, defaultBufferConfig);
      for (let i = 0; i < defaultBufferConfig.maxExportBatchSize; i++) {
        const span = createSampledSpan(`${name}_${i}`);
        processor.onEnd(span);
      }
      assert.strictEqual(exporter.getFinishedSpans().length, 0);
      processor.forceFlush();
      assert.strictEqual(exporter.getFinishedSpans().length, 5);
    });

    it('should not export empty span lists', done => {
      const spy = sinon.spy(exporter, 'export');
      const clock = sinon.useFakeTimers();

      const tracer = new BasicTracerProvider({
        sampler: new AlwaysOnSampler(),
      }).getTracer('default');
      const processor = new BatchSpanProcessor(exporter, defaultBufferConfig);

      // start but do not end spans
      for (let i = 0; i < defaultBufferConfig.maxExportBatchSize; i++) {
        const span = tracer.startSpan('spanName');
        processor.onStart(span as Span);
      }

      setTimeout(() => {
        assert.strictEqual(exporter.getFinishedSpans().length, 0);
        // after the timeout, export should not have been called
        // because no spans are ended
        sinon.assert.notCalled(spy);
        done();
      }, defaultBufferConfig.scheduledDelayMillis + 1000);

      // no spans have been finished
      assert.strictEqual(exporter.getFinishedSpans().length, 0);
      clock.tick(defaultBufferConfig.scheduledDelayMillis + 1000);

      clock.restore();
    });

    it(
      'should export each sampled span exactly once with buffer size' +
        ' reached multiple times',
      done => {
        const originalTimeout = setTimeout;
        const clock = sinon.useFakeTimers();
        const processor = new BatchSpanProcessor(exporter, defaultBufferConfig);
        const totalSpans = defaultBufferConfig.maxExportBatchSize * 2;
        for (let i = 0; i < totalSpans; i++) {
          const span = createSampledSpan(`${name}_${i}`);
          processor.onEnd(span);
        }
        const span = createSampledSpan(`${name}_last`);
        processor.onEnd(span);
        clock.tick(defaultBufferConfig.scheduledDelayMillis + 10);

        // because there is an async promise that will be trigger original
        // timeout is needed to simulate a real tick to the next
        originalTimeout(() => {
          clock.tick(defaultBufferConfig.scheduledDelayMillis + 10);
          originalTimeout(async () => {
            clock.tick(defaultBufferConfig.scheduledDelayMillis + 10);
            clock.restore();

            diag.info(
              'finished spans count',
              exporter.getFinishedSpans().length
            );
            assert.strictEqual(
              exporter.getFinishedSpans().length,
              totalSpans + 1
            );

            await processor.shutdown();
            assert.strictEqual(exporter.getFinishedSpans().length, 0);
            done();
          });
        });
      }
    );
  });

  describe('force flush', () => {
    describe('no waiting spans', () => {
      it('should call an async callback when flushing is complete', done => {
        const processor = new BatchSpanProcessor(exporter);
        processor.forceFlush().then(() => {
          done();
        });
      });

      it('should call an async callback when shutdown is complete', done => {
        const processor = new BatchSpanProcessor(exporter);
        processor.shutdown().then(() => {
          done();
        });
      });
    });

    describe('spans waiting to flush', () => {
      let processor: BatchSpanProcessor;

      beforeEach(() => {
        processor = new BatchSpanProcessor(exporter, defaultBufferConfig);
      });

      it('should call an async callback when flushing is complete', done => {
        const span = createSampledSpan('test');
        processor.onStart(span);
        processor.onEnd(span);
        processor.forceFlush().then(() => {
          assert.strictEqual(exporter.getFinishedSpans().length, 1);
          done();
        });
      });

      it('should call an async callback when shutdown is complete', done => {
        let exportedSpans = 0;
        sinon.stub(exporter, 'export').callsFake((spans, callback) => {
          setTimeout(() => {
            exportedSpans = exportedSpans + spans.length;
            callback({ code: ExportResultCode.SUCCESS });
          }, 0);
        });
        const span = createSampledSpan('test');
        processor.onStart(span);
        processor.onEnd(span);

        processor.shutdown().then(() => {
          assert.strictEqual(exportedSpans, 1);
          done();
        });
      });

      it('should call globalErrorHandler when exporting fails', done => {
        const clock = sinon.useFakeTimers();
        const expectedError = new Error('Exporter failed');
        sinon.stub(exporter, 'export').callsFake((_, callback) => {
          setTimeout(() => {
            callback({ code: ExportResultCode.FAILED, error: expectedError });
          }, 0);
        });

        const errorHandlerSpy = sinon.spy();

        setGlobalErrorHandler(errorHandlerSpy);

        for (let i = 0; i < defaultBufferConfig.maxExportBatchSize; i++) {
          const span = createSampledSpan('test');
          processor.onStart(span);
          processor.onEnd(span);
        }

        clock.tick(defaultBufferConfig.scheduledDelayMillis + 1000);
        clock.restore();
        setTimeout(async () => {
          assert.strictEqual(errorHandlerSpy.callCount, 1);

          const [[error]] = errorHandlerSpy.args;

          assert.deepStrictEqual(error, expectedError);

          //reset global error handler
          setGlobalErrorHandler(loggingErrorHandler());
          done();
        });
      });
    });

    describe('flushing spans with exporter triggering instrumentation', () => {
      beforeEach(() => {
        const contextManager = new TestStackContextManager().enable();
        context.setGlobalContextManager(contextManager);
      });

      afterEach(() => {
        context.disable();
      });

      it('should prevent instrumentation prior to export', done => {
        const testTracingExporter = new TestTracingSpanExporter();
        const processor = new BatchSpanProcessor(testTracingExporter);

        const span = createSampledSpan('test');
        processor.onStart(span);
        processor.onEnd(span);

        processor.forceFlush().then(() => {
          const exporterCreatedSpans = testTracingExporter.getExporterCreatedSpans();
          assert.equal(exporterCreatedSpans.length, 0);

          done();
        });
      });
    });
  });
  describe('maxQueueSize', () => {
    let processor: BatchSpanProcessor;

    describe('when there are more spans then "maxQueueSize"', () => {
      beforeEach(() => {
        processor = new BatchSpanProcessor(
          exporter,
          Object.assign({}, defaultBufferConfig, {
            maxQueueSize: 6,
          })
        );
      });
      it('should drop spans', () => {
        const span = createSampledSpan('test');
        for (let i = 0, j = 20; i < j; i++) {
          processor.onStart(span);
          processor.onEnd(span);
        }
        assert.equal(processor['_finishedSpans'].length, 6);
      });
    });
  });
});
