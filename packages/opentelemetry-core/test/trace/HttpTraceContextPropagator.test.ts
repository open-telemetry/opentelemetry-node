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
  INVALID_SPANID,
  INVALID_TRACEID,
  ROOT_CONTEXT,
  SpanContext, trace,
  TraceFlags,
} from '@opentelemetry/api';
import * as assert from 'assert';
import {
  HttpTraceContextPropagator,
  TRACE_PARENT_HEADER,
  TRACE_STATE_HEADER,
} from '../../src/trace/HttpTraceContextPropagator';
import { suppressTracing } from '../../src/trace/suppress-tracing';
import { TraceState } from '../../src/trace/TraceState';

describe('HttpTraceContextPropagator', () => {
  const httpTraceContext = new HttpTraceContextPropagator();
  let carrier: { [key: string]: unknown };

  beforeEach(() => {
    carrier = {};
  });

  describe('.inject()', () => {
    it('should set traceparent header', () => {
      const spanContext: SpanContext = {
        traceId: 'd4cda95b652f4a1592b449d5929fda1b',
        spanId: '6e0c63257de34c92',
        traceFlags: TraceFlags.SAMPLED,
      };

      httpTraceContext.inject(
        trace.setSpanContext(ROOT_CONTEXT, spanContext),
        carrier,
        defaultTextMapSetter
      );
      assert.deepStrictEqual(
        carrier[TRACE_PARENT_HEADER],
        '00-d4cda95b652f4a1592b449d5929fda1b-6e0c63257de34c92-01'
      );
      assert.deepStrictEqual(carrier[TRACE_STATE_HEADER], undefined);
    });

    it('should set traceparent and tracestate header', () => {
      const spanContext: SpanContext = {
        traceId: 'd4cda95b652f4a1592b449d5929fda1b',
        spanId: '6e0c63257de34c92',
        traceFlags: TraceFlags.SAMPLED,
        traceState: new TraceState('foo=bar,baz=qux'),
      };

      httpTraceContext.inject(
        trace.setSpanContext(ROOT_CONTEXT, spanContext),
        carrier,
        defaultTextMapSetter
      );
      assert.deepStrictEqual(
        carrier[TRACE_PARENT_HEADER],
        '00-d4cda95b652f4a1592b449d5929fda1b-6e0c63257de34c92-01'
      );
      assert.deepStrictEqual(carrier[TRACE_STATE_HEADER], 'foo=bar,baz=qux');
    });

    it('should not set traceparent and tracestate header if instrumentation is suppressed', () => {
      const spanContext: SpanContext = {
        traceId: 'd4cda95b652f4a1592b449d5929fda1b',
        spanId: '6e0c63257de34c92',
        traceFlags: TraceFlags.SAMPLED,
      };

      httpTraceContext.inject(
        suppressTracing(trace.setSpanContext(ROOT_CONTEXT, spanContext)),
        carrier,
        defaultTextMapSetter
      );
      assert.strictEqual(carrier[TRACE_PARENT_HEADER], undefined);
      assert.strictEqual(carrier[TRACE_STATE_HEADER], undefined);
    });

    it('should ignore invalid span context', () => {
      const spanContext: SpanContext = {
        traceId: INVALID_TRACEID,
        spanId: INVALID_SPANID,
        traceFlags: TraceFlags.NONE,
        traceState: new TraceState('foo=bar,baz=qux'),
      };

      httpTraceContext.inject(
        suppressTracing(trace.setSpanContext(ROOT_CONTEXT, spanContext)),
        carrier,
        defaultTextMapSetter
      );
      assert.strictEqual(carrier[TRACE_PARENT_HEADER], undefined);
      assert.strictEqual(carrier[TRACE_STATE_HEADER], undefined);
    });
  });

  describe('.extract()', () => {
    it('should extract context of a sampled span from carrier', () => {
      carrier[TRACE_PARENT_HEADER] =
        '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
      const extractedSpanContext = trace.getSpanContext(
        httpTraceContext.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
      );

      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'b7ad6b7169203331',
        traceId: '0af7651916cd43dd8448eb211c80319c',
        isRemote: true,
        traceFlags: TraceFlags.SAMPLED,
      });
    });

    it('should extract context of a sampled span from carrier using a future version', () => {
      carrier[TRACE_PARENT_HEADER] =
        'cc-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
      const extractedSpanContext = trace.getSpanContext(
        httpTraceContext.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
      );

      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'b7ad6b7169203331',
        traceId: '0af7651916cd43dd8448eb211c80319c',
        isRemote: true,
        traceFlags: TraceFlags.SAMPLED,
      });
    });

    it('should extract context of a sampled span from carrier using a future version and future fields', () => {
      carrier[TRACE_PARENT_HEADER] =
        'cc-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01-what-the-future-will-be-like';
      const extractedSpanContext = trace.getSpanContext(
        httpTraceContext.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
      );

      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'b7ad6b7169203331',
        traceId: '0af7651916cd43dd8448eb211c80319c',
        isRemote: true,
        traceFlags: TraceFlags.SAMPLED,
      });
    });

    it('returns null if traceparent header is missing', () => {
      assert.deepStrictEqual(
        trace.getSpanContext(
          httpTraceContext.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
        ),
        undefined
      );
    });

    it('returns null if traceparent header is invalid', () => {
      carrier[TRACE_PARENT_HEADER] = 'invalid!';
      assert.deepStrictEqual(
        trace.getSpanContext(
          httpTraceContext.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
        ),
        undefined
      );
    });

    it('should return null if matching version but extra fields (invalid)', () => {
      // Version 00 (our current) consists of {version}-{traceId}-{parentId}-{flags}
      carrier[TRACE_PARENT_HEADER] =
        '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01-extra';

      assert.deepStrictEqual(
        trace.getSpanContext(
          httpTraceContext.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
        ),
        undefined
      );
    });

    it('extracts traceparent from list of header', () => {
      carrier[TRACE_PARENT_HEADER] = [
        '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      ];
      const extractedSpanContext = trace.getSpanContext(
        httpTraceContext.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
      );
      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'b7ad6b7169203331',
        traceId: '0af7651916cd43dd8448eb211c80319c',
        isRemote: true,
        traceFlags: TraceFlags.SAMPLED,
      });
    });

    it('extracts tracestate from header', () => {
      carrier[TRACE_PARENT_HEADER] =
        '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
      carrier[TRACE_STATE_HEADER] = 'foo=bar,baz=qux';
      const extractedSpanContext = trace.getSpanContext(
        httpTraceContext.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
      );

      assert.deepStrictEqual(
        extractedSpanContext!.traceState!.get('foo'),
        'bar'
      );
      assert.deepStrictEqual(
        extractedSpanContext!.traceState!.get('baz'),
        'qux'
      );
    });

    it('combines multiple tracestate carrier', () => {
      carrier[TRACE_PARENT_HEADER] =
        '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
      carrier[TRACE_STATE_HEADER] = ['foo=bar,baz=qux', 'quux=quuz'];
      const extractedSpanContext = trace.getSpanContext(
        httpTraceContext.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
      );
      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'b7ad6b7169203331',
        traceId: '0af7651916cd43dd8448eb211c80319c',
        isRemote: true,
        traceFlags: TraceFlags.SAMPLED,
        traceState: new TraceState('foo=bar,baz=qux,quux=quuz'),
      });
    });

    it('should gracefully handle an invalid traceparent header', () => {
      // A set of test cases with different invalid combinations of a
      // traceparent header. These should all result in a `null` SpanContext
      // value being extracted.

      const testCases: Record<string, string> = {
        invalidParts_tooShort: '00-ffffffffffffffffffffffffffffffff',

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
        invalidFutureVersion:
          'ff-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        invalidFutureFieldAfterFlag:
          'cc-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01.what-the-future-will-not-be-like',
      };

      Object.getOwnPropertyNames(testCases).forEach(testCase => {
        carrier[TRACE_PARENT_HEADER] = testCases[testCase];

        const extractedSpanContext = trace.getSpanContext(
          httpTraceContext.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
        );
        assert.deepStrictEqual(extractedSpanContext, undefined, testCase);
      });
    });

    it('should handle OWS in tracestate list members', () => {
      carrier[TRACE_PARENT_HEADER] =
        '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
      carrier[TRACE_STATE_HEADER] = 'foo=1 \t , \t bar=2, \t baz=3 ';
      const extractedSpanContext = trace.getSpanContext(
        httpTraceContext.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
      );

      assert.deepStrictEqual(extractedSpanContext!.traceState!.get('foo'), '1');
      assert.deepStrictEqual(extractedSpanContext!.traceState!.get('bar'), '2');
      assert.deepStrictEqual(extractedSpanContext!.traceState!.get('baz'), '3');
    });

    it('should fail gracefully on bad responses from getter', () => {
      const ctx1 = httpTraceContext.extract(ROOT_CONTEXT, carrier, {
        // @ts-expect-error verify with number
        get: (c, k) => 1, // not a number
        keys: () => [],
      });
      const ctx2 = httpTraceContext.extract(ROOT_CONTEXT, carrier, {
        get: (c, k) => [], // empty array
        keys: () => [],
      });
      const ctx3 = httpTraceContext.extract(ROOT_CONTEXT, carrier, {
        get: (c, k) => undefined, // missing value
        keys: () => [],
      });

      assert.ok(ctx1 === ROOT_CONTEXT);
      assert.ok(ctx2 === ROOT_CONTEXT);
      assert.ok(ctx3 === ROOT_CONTEXT);
    });
  });

  describe('fields()', () => {
    it('should return fields used by trace context', () => {
      const fields = httpTraceContext.fields();
      assert.deepStrictEqual(fields, [TRACE_PARENT_HEADER, TRACE_STATE_HEADER]);
    });
  });
});
