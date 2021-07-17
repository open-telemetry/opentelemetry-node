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
import { Span } from '@opentelemetry/api';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-base-tracing';
import { WebTracerProvider } from '@opentelemetry/sdk-web-tracing';
import { XMLHttpRequestInstrumentation } from '../src';
import assert = require('assert');

class TestSpanProcessor implements SpanProcessor {
  spans: ReadableSpan[] = [];

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
  onStart(span: Span): void {}
  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  onEnd(span: ReadableSpan): void {
    this.spans.push(span);
  }
}

describe('unmocked xhr', () => {
  let testSpans: TestSpanProcessor;
  let provider: WebTracerProvider;
  beforeEach(() => {
    provider = new WebTracerProvider();
    registerInstrumentations({
      instrumentations: [new XMLHttpRequestInstrumentation()],
      tracerProvider: provider,
    });
    testSpans = new TestSpanProcessor();
    provider.addSpanProcessor(testSpans);
  });
  afterEach(() => {
    // nop
  });

  it('should find resource with a relative url', done => {
    const xhr = new XMLHttpRequest();
    let path = location.pathname;
    path = path.substring(path.lastIndexOf('/') + 1);
    xhr.open('GET', path);
    xhr.addEventListener('loadend', () => {
      setTimeout(() => {
        assert.strictEqual(testSpans.spans.length, 1);
        const span = testSpans.spans[0];
        // content length comes from the PerformanceTiming resource; this ensures that our
        // matching logic found the right one
        assert.ok(
          (span.attributes[
            SemanticAttributes.HTTP_RESPONSE_CONTENT_LENGTH
          ] as any) > 0
        );
        done();
      }, 500);
    });
    xhr.send();
  });
});
