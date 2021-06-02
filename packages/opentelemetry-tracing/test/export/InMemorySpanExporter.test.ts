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
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  BasicTracerProvider,
} from '../../src';
import { context, trace } from '@opentelemetry/api';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';

describe('InMemorySpanExporter', () => {
  let memoryExporter: InMemorySpanExporter;
  let provider: BasicTracerProvider;

  beforeEach(() => {
    memoryExporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(memoryExporter));
  });

  it('should get finished spans', () => {
    const root = provider.getTracer('default').startSpan('root');
    const child = provider
      .getTracer('default')
      .startSpan('child', {}, trace.setSpan(context.active(), root));
    const grandChild = provider
      .getTracer('default')
      .startSpan('grand-child', {}, trace.setSpan(context.active(), child));

    assert.strictEqual(memoryExporter.getFinishedSpans().length, 0);
    grandChild.end();
    assert.strictEqual(memoryExporter.getFinishedSpans().length, 1);
    child.end();
    assert.strictEqual(memoryExporter.getFinishedSpans().length, 2);
    root.end();
    assert.strictEqual(memoryExporter.getFinishedSpans().length, 3);

    const [span1, span2, span3] = memoryExporter.getFinishedSpans();
    assert.strictEqual(span1.name, 'grand-child');
    assert.strictEqual(span2.name, 'child');
    assert.strictEqual(span3.name, 'root');
    assert.strictEqual(span1.spanContext().traceId, span2.spanContext().traceId);
    assert.strictEqual(span2.spanContext().traceId, span3.spanContext().traceId);
    assert.strictEqual(span1.parentSpanId, span2.spanContext().spanId);
    assert.strictEqual(span2.parentSpanId, span3.spanContext().spanId);
  });

  it('should shutdown the exporter', () => {
    const root = provider.getTracer('default').startSpan('root');

    provider
      .getTracer('default')
      .startSpan('child', {}, trace.setSpan(context.active(), root))
      .end();
    root.end();
    assert.strictEqual(memoryExporter.getFinishedSpans().length, 2);
    memoryExporter.shutdown();
    assert.strictEqual(memoryExporter.getFinishedSpans().length, 0);

    // after shutdown no new spans are accepted
    provider
      .getTracer('default')
      .startSpan('child1', {}, trace.setSpan(context.active(), root))
      .end();
    assert.strictEqual(memoryExporter.getFinishedSpans().length, 0);
  });

  it('should return the success result', () => {
    const exorter = new InMemorySpanExporter();
    exorter.export([], (result: ExportResult) => {
      assert.strictEqual(result.code, ExportResultCode.SUCCESS);
    });
  });

  it('should return the FailedNotRetryable result after shutdown', () => {
    const exorter = new InMemorySpanExporter();
    exorter.shutdown();

    // after shutdown export should fail
    exorter.export([], (result: ExportResult) => {
      assert.strictEqual(result.code, ExportResultCode.FAILED);
    });
  });
});
