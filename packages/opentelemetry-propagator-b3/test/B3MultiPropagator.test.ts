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
  SpanContext,
  trace,
  TraceFlags,
} from '@opentelemetry/api';
import { ROOT_CONTEXT } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';
import * as assert from 'assert';
import { B3MultiPropagator } from '../src/B3MultiPropagator';
import {
  X_B3_FLAGS,
  X_B3_PARENT_SPAN_ID,
  X_B3_SAMPLED,
  X_B3_SPAN_ID,
  X_B3_TRACE_ID,
} from '../src/constants';
import { B3_DEBUG_FLAG_KEY } from '../src/common';

describe('B3MultiPropagator', () => {
  const b3Propagator = new B3MultiPropagator();
  let carrier: { [key: string]: unknown };

  beforeEach(() => {
    carrier = {};
  });

  describe('.inject()', () => {
    it('should set b3 traceId and spanId headers', () => {
      const spanContext: SpanContext = {
        traceId: 'd4cda95b652f4a1592b449d5929fda1b',
        spanId: '6e0c63257de34c92',
        traceFlags: TraceFlags.SAMPLED,
      };

      b3Propagator.inject(
        trace.setSpanContext(ROOT_CONTEXT, spanContext),
        carrier,
        defaultTextMapSetter
      );
      assert.deepStrictEqual(
        carrier[X_B3_TRACE_ID],
        'd4cda95b652f4a1592b449d5929fda1b'
      );
      assert.deepStrictEqual(carrier[X_B3_SPAN_ID], '6e0c63257de34c92');
      assert.deepStrictEqual(carrier[X_B3_SAMPLED], '1');
      assert.deepStrictEqual(carrier[X_B3_FLAGS], undefined);
    });

    it('should set b3 traceId and spanId headers - ignore tracestate', () => {
      const spanContext: SpanContext = {
        traceId: 'd4cda95b652f4a1592b449d5929fda1b',
        spanId: '6e0c63257de34c92',
        traceFlags: TraceFlags.NONE,
        traceState: {
          get: (key: string) => {
            return undefined;
          },
          set: function (key: string, value: string) {
            return this;
          },
          unset: function (key: string) {
            return this;
          },
          serialize: () => {
            return 'foo=bar,baz=quux';
          },
        },
        isRemote: false,
      };

      b3Propagator.inject(
        trace.setSpanContext(ROOT_CONTEXT, spanContext),
        carrier,
        defaultTextMapSetter
      );
      assert.deepStrictEqual(
        carrier[X_B3_TRACE_ID],
        'd4cda95b652f4a1592b449d5929fda1b'
      );
      assert.deepStrictEqual(carrier[X_B3_SPAN_ID], '6e0c63257de34c92');
      assert.deepStrictEqual(carrier[X_B3_SAMPLED], '0');
      assert.deepStrictEqual(carrier[X_B3_FLAGS], undefined);
    });

    it('should set flags headers', () => {
      const spanContext: SpanContext = {
        traceId: 'd4cda95b652f4a1592b449d5929fda1b',
        spanId: '6e0c63257de34c92',
        traceFlags: TraceFlags.NONE,
      };
      const contextWithDebug = ROOT_CONTEXT.setValue(B3_DEBUG_FLAG_KEY, '1');

      b3Propagator.inject(
        trace.setSpanContext(contextWithDebug, spanContext),
        carrier,
        defaultTextMapSetter
      );
      assert.deepStrictEqual(
        carrier[X_B3_TRACE_ID],
        'd4cda95b652f4a1592b449d5929fda1b'
      );
      assert.deepStrictEqual(carrier[X_B3_SPAN_ID], '6e0c63257de34c92');
      assert.deepStrictEqual(carrier[X_B3_FLAGS], '1');
      assert.deepStrictEqual(carrier[X_B3_SAMPLED], undefined);
    });

    it('should not inject empty spancontext', () => {
      const emptySpanContext = {
        traceId: '',
        spanId: '',
        traceFlags: TraceFlags.NONE,
      };
      b3Propagator.inject(
        trace.setSpanContext(ROOT_CONTEXT, emptySpanContext),
        carrier,
        defaultTextMapSetter
      );
      assert.deepStrictEqual(carrier[X_B3_TRACE_ID], undefined);
      assert.deepStrictEqual(carrier[X_B3_SPAN_ID], undefined);
      assert.deepStrictEqual(carrier[X_B3_FLAGS], undefined);
      assert.deepStrictEqual(carrier[X_B3_PARENT_SPAN_ID], undefined);
    });

    it('should not inject if instrumentation suppressed', () => {
      const spanContext = {
        traceId: 'd4cda95b652f4a1592b449d5929fda1b',
        spanId: '6e0c63257de34c92',
        traceFlags: TraceFlags.SAMPLED,
      };
      b3Propagator.inject(
        suppressTracing(trace.setSpanContext(ROOT_CONTEXT, spanContext)),
        carrier,
        defaultTextMapSetter
      );
      assert.strictEqual(carrier[X_B3_TRACE_ID], undefined);
      assert.strictEqual(carrier[X_B3_SPAN_ID], undefined);
      assert.strictEqual(carrier[X_B3_FLAGS], undefined);
      assert.strictEqual(carrier[X_B3_PARENT_SPAN_ID], undefined);
    });
  });

  describe('.extract()', () => {
    it('should extract context of a deferred span from carrier', () => {
      carrier[X_B3_TRACE_ID] = '0af7651916cd43dd8448eb211c80319c';
      carrier[X_B3_SPAN_ID] = 'b7ad6b7169203331';
      const context = b3Propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );
      const extractedSpanContext = trace.getSpanContext(context);
      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'b7ad6b7169203331',
        traceId: '0af7651916cd43dd8448eb211c80319c',
        isRemote: true,
        traceFlags: TraceFlags.NONE,
      });
      assert.strictEqual(context.getValue(B3_DEBUG_FLAG_KEY), undefined);
    });

    describe('when sampled flag is valid', () => {
      describe('AND sampled flag is 1', () => {
        it('should extract context of a sampled span from carrier', () => {
          carrier[X_B3_TRACE_ID] = '0af7651916cd43dd8448eb211c80319c';
          carrier[X_B3_SPAN_ID] = 'b7ad6b7169203331';
          carrier[X_B3_SAMPLED] = '1';
          const context = b3Propagator.extract(
            ROOT_CONTEXT,
            carrier,
            defaultTextMapGetter
          );
          const extractedSpanContext = trace.getSpanContext(context);

          assert.deepStrictEqual(extractedSpanContext, {
            spanId: 'b7ad6b7169203331',
            traceId: '0af7651916cd43dd8448eb211c80319c',
            isRemote: true,
            traceFlags: TraceFlags.SAMPLED,
          });
          assert.equal(context.getValue(B3_DEBUG_FLAG_KEY), undefined);
        });
      });

      describe('AND sampled flag is true', () => {
        it('should extract context of a sampled span from carrier', () => {
          carrier[X_B3_TRACE_ID] = '0af7651916cd43dd8448eb211c80319c';
          carrier[X_B3_SPAN_ID] = 'b7ad6b7169203331';
          carrier[X_B3_SAMPLED] = true;
          const context = b3Propagator.extract(
            ROOT_CONTEXT,
            carrier,
            defaultTextMapGetter
          );
          const extractedSpanContext = trace.getSpanContext(context);

          assert.deepStrictEqual(extractedSpanContext, {
            spanId: 'b7ad6b7169203331',
            traceId: '0af7651916cd43dd8448eb211c80319c',
            isRemote: true,
            traceFlags: TraceFlags.SAMPLED,
          });
          assert.equal(context.getValue(B3_DEBUG_FLAG_KEY), undefined);
        });
      });

      describe('AND sampled flag is false', () => {
        it('should extract context of a sampled span from carrier', () => {
          carrier[X_B3_TRACE_ID] = '0af7651916cd43dd8448eb211c80319c';
          carrier[X_B3_SPAN_ID] = 'b7ad6b7169203331';
          carrier[X_B3_SAMPLED] = false;
          const context = b3Propagator.extract(
            ROOT_CONTEXT,
            carrier,
            defaultTextMapGetter
          );
          const extractedSpanContext = trace.getSpanContext(context);

          assert.deepStrictEqual(extractedSpanContext, {
            spanId: 'b7ad6b7169203331',
            traceId: '0af7651916cd43dd8448eb211c80319c',
            isRemote: true,
            traceFlags: TraceFlags.NONE,
          });
          assert.equal(context.getValue(B3_DEBUG_FLAG_KEY), undefined);
        });
      });
    });

    describe('when debug flag is valid', () => {
      describe('AND debug flag is 1', () => {
        it('should extract context of a debug span from carrier', () => {
          carrier[X_B3_TRACE_ID] = '0af7651916cd43dd8448eb211c80319c';
          carrier[X_B3_SPAN_ID] = 'b7ad6b7169203331';
          carrier[X_B3_FLAGS] = '1';
          const context = b3Propagator.extract(
            ROOT_CONTEXT,
            carrier,
            defaultTextMapGetter
          );
          const extractedSpanContext = trace.getSpanContext(context);

          assert.deepStrictEqual(extractedSpanContext, {
            spanId: 'b7ad6b7169203331',
            traceId: '0af7651916cd43dd8448eb211c80319c',
            isRemote: true,
            traceFlags: TraceFlags.SAMPLED,
          });
          assert.strictEqual(context.getValue(B3_DEBUG_FLAG_KEY), '1');
        });
      });
    });

    describe('when debug flag is invalid', () => {
      describe('AND debug flag is 0', () => {
        it('should extract context of a span from carrier', () => {
          carrier[X_B3_TRACE_ID] = '0af7651916cd43dd8448eb211c80319c';
          carrier[X_B3_SPAN_ID] = 'b7ad6b7169203331';
          carrier[X_B3_FLAGS] = '0';
          carrier[X_B3_SAMPLED] = '1';
          const context = b3Propagator.extract(
            ROOT_CONTEXT,
            carrier,
            defaultTextMapGetter
          );
          const extractedSpanContext = trace.getSpanContext(context);

          assert.deepStrictEqual(extractedSpanContext, {
            spanId: 'b7ad6b7169203331',
            traceId: '0af7651916cd43dd8448eb211c80319c',
            isRemote: true,
            traceFlags: TraceFlags.SAMPLED,
          });
          assert.equal(context.getValue(B3_DEBUG_FLAG_KEY), undefined);
        });
      });

      describe('AND debug flag is false', () => {
        it('should extract context of a span from carrier', () => {
          carrier[X_B3_TRACE_ID] = '0af7651916cd43dd8448eb211c80319c';
          carrier[X_B3_SPAN_ID] = 'b7ad6b7169203331';
          carrier[X_B3_FLAGS] = 'false';
          carrier[X_B3_SAMPLED] = '0';
          const context = b3Propagator.extract(
            ROOT_CONTEXT,
            carrier,
            defaultTextMapGetter
          );
          const extractedSpanContext = trace.getSpanContext(context);

          assert.deepStrictEqual(extractedSpanContext, {
            spanId: 'b7ad6b7169203331',
            traceId: '0af7651916cd43dd8448eb211c80319c',
            isRemote: true,
            traceFlags: TraceFlags.NONE,
          });
          assert.equal(context.getValue(B3_DEBUG_FLAG_KEY), undefined);
        });
      });

      describe('AND debug flag is true', () => {
        it('should extract context of a span from carrier', () => {
          carrier[X_B3_TRACE_ID] = '0af7651916cd43dd8448eb211c80319c';
          carrier[X_B3_SPAN_ID] = 'b7ad6b7169203331';
          carrier[X_B3_FLAGS] = 'true';
          carrier[X_B3_SAMPLED] = '0';
          const context = b3Propagator.extract(
            ROOT_CONTEXT,
            carrier,
            defaultTextMapGetter
          );
          const extractedSpanContext = trace.getSpanContext(context);

          assert.deepStrictEqual(extractedSpanContext, {
            spanId: 'b7ad6b7169203331',
            traceId: '0af7651916cd43dd8448eb211c80319c',
            isRemote: true,
            traceFlags: TraceFlags.NONE,
          });
          assert.equal(context.getValue(B3_DEBUG_FLAG_KEY), undefined);
        });
      });

      describe('AND debug flag is 2', () => {
        it('should extract context of a span from carrier', () => {
          carrier[X_B3_TRACE_ID] = '0af7651916cd43dd8448eb211c80319c';
          carrier[X_B3_SPAN_ID] = 'b7ad6b7169203331';
          carrier[X_B3_FLAGS] = '3';
          carrier[X_B3_SAMPLED] = '0';
          const context = b3Propagator.extract(
            ROOT_CONTEXT,
            carrier,
            defaultTextMapGetter
          );
          const extractedSpanContext = trace.getSpanContext(context);

          assert.deepStrictEqual(extractedSpanContext, {
            spanId: 'b7ad6b7169203331',
            traceId: '0af7651916cd43dd8448eb211c80319c',
            isRemote: true,
            traceFlags: TraceFlags.NONE,
          });
          assert.equal(context.getValue(B3_DEBUG_FLAG_KEY), undefined);
        });
      });
    });

    describe('when headers are invalid', () => {
      describe('AND traceId is undefined', () => {
        it('should return undefined', () => {
          carrier[X_B3_TRACE_ID] = undefined;
          carrier[X_B3_SPAN_ID] = 'b7ad6b7169203331';
          const context = trace.getSpanContext(
            b3Propagator.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
          );
          assert.deepStrictEqual(context, undefined);
        });
      });

      describe('AND spanId is undefined', () => {
        it('should return undefined', () => {
          carrier[X_B3_TRACE_ID] = '0af7651916cd43dd8448eb211c80319c';
          carrier[X_B3_SPAN_ID] = undefined;
          const context = trace.getSpanContext(
            b3Propagator.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
          );
          assert.deepStrictEqual(context, undefined);
        });
      });

      describe('AND sample is 2', () => {
        it('should return undefined', () => {
          carrier[X_B3_TRACE_ID] = '0af7651916cd43dd8448eb211c80319c';
          carrier[X_B3_SPAN_ID] = 'b7ad6b7169203331';
          carrier[X_B3_SAMPLED] = '2';
          const context = trace.getSpanContext(
            b3Propagator.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
          );
          assert.deepStrictEqual(context, undefined);
        });
      });

      describe('AND b3 header is missing', () => {
        it('should return undefined', () => {
          const context = trace.getSpanContext(
            b3Propagator.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
          );
          assert.deepStrictEqual(context, undefined);
        });
      });

      describe('AND trace id is invalid', () => {
        it('should return undefined', () => {
          carrier[X_B3_TRACE_ID] = 'invalid!';
          carrier[X_B3_SPAN_ID] = 'b7ad6b7169203331';
          const context = trace.getSpanContext(
            b3Propagator.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
          );
          assert.deepStrictEqual(context, undefined);
        });
      });
    });

    it('extracts b3 from list of header', () => {
      carrier[X_B3_TRACE_ID] = ['0af7651916cd43dd8448eb211c80319c'];
      carrier[X_B3_SPAN_ID] = 'b7ad6b7169203331';
      carrier[X_B3_SAMPLED] = '1';
      const context = b3Propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );
      const extractedSpanContext = trace.getSpanContext(context);
      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'b7ad6b7169203331',
        traceId: '0af7651916cd43dd8448eb211c80319c',
        isRemote: true,
        traceFlags: TraceFlags.SAMPLED,
      });
      assert.equal(context.getValue(B3_DEBUG_FLAG_KEY), undefined);
    });

    it('should gracefully handle an invalid b3 header', () => {
      // A set of test cases with different invalid combinations of a
      // b3 header. These should all result in a `undefined` SpanContext
      // value being extracted.

      const testCases: Record<string, string> = {
        invalidParts_tooShort: '00-ffffffffffffffffffffffffffffffff',
        invalidParts_tooLong:
          '00-ffffffffffffffffffffffffffffffff-ffffffffffffffff-00-01',

        invalidVersion_notHex:
          '0x-ffffffffffffffffffffffffffffffff-ffffffffffffffff-00',
        invalidVersion_tooShort:
          '0-ffffffffffffffffffffffffffffffff-ffffffffffffffff-00',
        invalidVersion_tooLong:
          '000-ffffffffffffffffffffffffffffffff-ffffffffffffffff-00',

        invalidTraceId_empty: '00--ffffffffffffffff-01',
        invalidTraceId_notHex:
          '00-fffffffffffffffffffffffffffffffx-ffffffffffffffff-01',
        invalidTraceId_allZeros:
          '00-00000000000000000000000000000000-ffffffffffffffff-01',
        invalidTraceId_tooShort: '00-ffffffff-ffffffffffffffff-01',
        invalidTraceId_tooLong:
          '00-ffffffffffffffffffffffffffffffff00-ffffffffffffffff-01',

        invalidSpanId_empty: '00-ffffffffffffffffffffffffffffffff--01',
        invalidSpanId_notHex:
          '00-ffffffffffffffffffffffffffffffff-fffffffffffffffx-01',
        invalidSpanId_allZeros:
          '00-ffffffffffffffffffffffffffffffff-0000000000000000-01',
        invalidSpanId_tooShort:
          '00-ffffffffffffffffffffffffffffffff-ffffffff-01',
        invalidSpanId_tooLong:
          '00-ffffffffffffffffffffffffffffffff-ffffffffffffffff0000-01',
      };

      Object.getOwnPropertyNames(testCases).forEach(testCase => {
        carrier[X_B3_TRACE_ID] = testCases[testCase];
        const extractedSpanContext = trace.getSpanContext(
          b3Propagator.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
        );
        assert.deepStrictEqual(extractedSpanContext, undefined, testCase);
      });
    });

    it('should fail gracefully on bad responses from getter', () => {
      const ctx1 = b3Propagator.extract(ROOT_CONTEXT, carrier, {
        // @ts-expect-error verify number is not allowed
        get: (c, k) => 1, // not a number
        keys: defaultTextMapGetter.keys,
      });
      const ctx2 = b3Propagator.extract(ROOT_CONTEXT, carrier, {
        get: (c, k) => [], // empty array
        keys: defaultTextMapGetter.keys,
      });
      const ctx3 = b3Propagator.extract(ROOT_CONTEXT, carrier, {
        get: (c, k) => undefined, // missing value
        keys: defaultTextMapGetter.keys,
      });

      assert.ok(ctx1 === ROOT_CONTEXT);
      assert.ok(ctx2 === ROOT_CONTEXT);
      assert.ok(ctx3 === ROOT_CONTEXT);
    });

    it('should left-pad 64 bit trace ids with 0', () => {
      carrier[X_B3_TRACE_ID] = '8448eb211c80319c';
      carrier[X_B3_SPAN_ID] = 'b7ad6b7169203331';
      carrier[X_B3_SAMPLED] = '1';
      const context = b3Propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );
      const extractedSpanContext = trace.getSpanContext(context);

      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'b7ad6b7169203331',
        traceId: '00000000000000008448eb211c80319c',
        isRemote: true,
        traceFlags: TraceFlags.SAMPLED,
      });
      assert.equal(context.getValue(B3_DEBUG_FLAG_KEY), undefined);
    });
  });
});
