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
  defaultTextMapGetter,
  defaultTextMapSetter,
  TextMapPropagator,
  SpanContext,
  getSpanContext,
  setSpanContext,
} from '@opentelemetry/api';
import { Context, ROOT_CONTEXT } from '@opentelemetry/api';
import * as assert from 'assert';
import {
  CompositePropagator,
  HttpTraceContextPropagator,
  RandomIdGenerator,
} from '../../src';
import {
  B3Propagator,
  B3InjectEncoding,
  X_B3_SAMPLED,
  X_B3_SPAN_ID,
  X_B3_TRACE_ID,
} from '@opentelemetry/propagator-b3';
import {
  TRACE_PARENT_HEADER,
  TRACE_STATE_HEADER,
} from '../../src/trace/HttpTraceContextPropagator';
import { TraceState } from '../../src/trace/TraceState';

describe('Composite Propagator', () => {
  let traceId: string;
  let spanId: string;

  beforeEach(() => {
    const idGenerator = new RandomIdGenerator();
    traceId = idGenerator.generateTraceId();
    spanId = idGenerator.generateSpanId();
  });

  describe('inject', () => {
    let carrier: { [key: string]: unknown };
    let spanContext: SpanContext;
    let ctxWithSpanContext: Context;

    beforeEach(() => {
      carrier = {};
      spanContext = {
        spanId,
        traceId,
        traceFlags: 1,
        traceState: new TraceState('foo=bar'),
      };
      ctxWithSpanContext = setSpanContext(ROOT_CONTEXT, spanContext);
    });

    it('should inject context using all configured propagators', () => {
      const composite = new CompositePropagator({
        propagators: [
          new B3Propagator({ injectEncoding: B3InjectEncoding.MULTI_HEADER }),
          new HttpTraceContextPropagator(),
        ],
      });
      composite.inject(ctxWithSpanContext, carrier, defaultTextMapSetter);

      assert.strictEqual(carrier[X_B3_TRACE_ID], traceId);
      assert.strictEqual(carrier[X_B3_SPAN_ID], spanId);
      assert.strictEqual(carrier[X_B3_SAMPLED], '1');
      assert.strictEqual(
        carrier[TRACE_PARENT_HEADER],
        `00-${traceId}-${spanId}-01`
      );
      assert.strictEqual(carrier[TRACE_STATE_HEADER], 'foo=bar');
    });

    it('should not throw', () => {
      const composite = new CompositePropagator({
        propagators: [
          new ThrowingPropagator(),
          new HttpTraceContextPropagator(),
        ],
      });
      composite.inject(ctxWithSpanContext, carrier, defaultTextMapSetter);

      assert.strictEqual(
        carrier[TRACE_PARENT_HEADER],
        `00-${traceId}-${spanId}-01`
      );
    });
  });

  describe('extract', () => {
    let carrier: { [key: string]: unknown };

    beforeEach(() => {
      carrier = {
        [X_B3_TRACE_ID]: traceId,
        [X_B3_SPAN_ID]: spanId,
        [X_B3_SAMPLED]: 1,
        [TRACE_PARENT_HEADER]: `00-${traceId}-${spanId}-01`,
        [TRACE_STATE_HEADER]: 'foo=bar',
      };
    });

    it('should extract context using all configured propagators', () => {
      const composite = new CompositePropagator({
        propagators: [
          new B3Propagator({ injectEncoding: B3InjectEncoding.MULTI_HEADER }),
          new HttpTraceContextPropagator(),
        ],
      });
      const spanContext = getSpanContext(
        composite.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
      );

      if (!spanContext) {
        throw new Error('no extracted context');
      }

      assert.strictEqual(spanContext.traceId, traceId);
      assert.strictEqual(spanContext.spanId, spanId);
      assert.strictEqual(spanContext.traceFlags, 1);
      assert.strictEqual(spanContext.isRemote, true);
      assert.strictEqual(spanContext.traceState!.get('foo'), 'bar');
    });

    it('should not throw', () => {
      const composite = new CompositePropagator({
        propagators: [
          new ThrowingPropagator(),
          new HttpTraceContextPropagator(),
        ],
      });
      const spanContext = getSpanContext(
        composite.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
      );

      if (!spanContext) {
        throw new Error('no extracted context');
      }

      assert.strictEqual(spanContext.traceId, traceId);
      assert.strictEqual(spanContext.spanId, spanId);
      assert.strictEqual(spanContext.traceFlags, 1);
      assert.strictEqual(spanContext.isRemote, true);
      assert.strictEqual(spanContext.traceState!.get('foo'), 'bar');
    });
  });

  describe('fields()', () => {
    it('should combine fields from both propagators', () => {
      const composite = new CompositePropagator({
        propagators: [
          {
            extract: c => c,
            inject: () => {},
            fields: () => ['p1'],
          },
          {
            extract: c => c,
            inject: () => {},
            fields: () => ['p2'],
          },
        ],
      });

      assert.deepStrictEqual(composite.fields(), ['p1', 'p2']);
    });

    it('should ignore propagators without fields function', () => {
      const composite = new CompositePropagator({
        propagators: [
          {
            extract: c => c,
            inject: () => {},
            fields: () => ['p1'],
          },
          // @ts-expect-error verify missing fields case
          {
            extract: c => c,
            inject: () => {},
          },
        ],
      });

      assert.deepStrictEqual(composite.fields(), ['p1']);
    });

    it('should not allow caller to modify fields', () => {
      const composite = new CompositePropagator({
        propagators: [
          {
            extract: c => c,
            inject: () => {},
            fields: () => ['p1'],
          },
          {
            extract: c => c,
            inject: () => {},
            fields: () => ['p2'],
          },
        ],
      });

      const fields = composite.fields();
      assert.deepStrictEqual(fields, ['p1', 'p2']);
      fields[1] = 'p3';
      assert.deepStrictEqual(composite.fields(), ['p1', 'p2']);
    });
  });
});

class ThrowingPropagator implements TextMapPropagator {
  inject(context: Context, carrier: unknown) {
    throw new Error('this propagator throws');
  }

  extract(context: Context, carrier: unknown): Context {
    throw new Error('This propagator throws');
  }

  fields(): string[] {
    return [];
  }
}
