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
import { NoopTracer, NOOP_SPAN } from '../../src/trace/NoopTracer';
import { SpanKind } from '@opentelemetry/types';

describe('NoopTracer', () => {
  it('do not crash', () => {
    const tracer = new NoopTracer();

    assert.deepStrictEqual(tracer.startSpan('span-name'), NOOP_SPAN);
    assert.deepStrictEqual(
      tracer.startSpan('span-name1', { kind: SpanKind.CLIENT }),
      NOOP_SPAN
    );
    assert.deepStrictEqual(
      tracer.startSpan('span-name2', {
        kind: SpanKind.CLIENT,
        isRecordingEvents: true,
      }),
      NOOP_SPAN
    );

    tracer.recordSpanData(NOOP_SPAN);

    assert.deepStrictEqual(tracer.getCurrentSpan(), NOOP_SPAN);
    const httpTextFormat = tracer.getHttpTextFormat();
    assert.ok(httpTextFormat);
    httpTextFormat.inject({ traceId: '', spanId: '' }, 'HttpTextFormat', {});
    httpTextFormat.extract('HttpTextFormat', {});
  });
});
