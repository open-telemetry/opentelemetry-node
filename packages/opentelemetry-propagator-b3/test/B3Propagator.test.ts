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
  TraceFlags,
  ROOT_CONTEXT,
  trace,
} from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';
import * as assert from 'assert';
import { B3Propagator } from '../src/B3Propagator';
import {
  B3_CONTEXT_HEADER,
  X_B3_FLAGS,
  X_B3_PARENT_SPAN_ID,
  X_B3_SAMPLED,
  X_B3_SPAN_ID,
  X_B3_TRACE_ID,
} from '../src/constants';
import { B3InjectEncoding } from '../src/types';

describe('B3Propagator', () => {
  let propagator: B3Propagator;
  let carrier: { [key: string]: unknown };

  beforeEach(() => {
    propagator = new B3Propagator();
    carrier = {};
  });

  describe('.inject()', () => {
    it('injects single header by default', () => {
      propagator = new B3Propagator();

      const spanContext: SpanContext = {
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        spanId: 'e457b5a2e4d86bd1',
        traceFlags: TraceFlags.SAMPLED,
      };

      propagator.inject(
        trace.setSpanContext(ROOT_CONTEXT, spanContext),
        carrier,
        defaultTextMapSetter
      );

      const expected = '80f198ee56343ba864fe8b2a57d3eff7-e457b5a2e4d86bd1-1';
      assert.strictEqual(carrier[B3_CONTEXT_HEADER], expected);
    });

    it('can be configured for multi header', () => {
      propagator = new B3Propagator({
        injectEncoding: B3InjectEncoding.MULTI_HEADER,
      });

      const spanContext: SpanContext = {
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        spanId: 'e457b5a2e4d86bd1',
        traceFlags: TraceFlags.SAMPLED,
      };

      propagator.inject(
        trace.setSpanContext(ROOT_CONTEXT, spanContext),
        carrier,
        defaultTextMapSetter
      );

      assert.strictEqual(
        carrier[X_B3_TRACE_ID],
        '80f198ee56343ba864fe8b2a57d3eff7'
      );
      assert.strictEqual(carrier[X_B3_SPAN_ID], 'e457b5a2e4d86bd1');
      assert.strictEqual(carrier[X_B3_SAMPLED], '1');
    });

    it('should not inject if instrumentation suppressed', () => {
      propagator = new B3Propagator();

      const spanContext: SpanContext = {
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        spanId: 'e457b5a2e4d86bd1',
        traceFlags: TraceFlags.SAMPLED,
      };

      propagator.inject(
        suppressTracing(trace.setSpanContext(ROOT_CONTEXT, spanContext)),
        carrier,
        defaultTextMapSetter
      );

      assert.strictEqual(carrier[B3_CONTEXT_HEADER], undefined);
    });
  });

  describe('.extract()', () => {
    const b3SingleCarrier = {
      [B3_CONTEXT_HEADER]:
        '80f198ee56343ba864fe8b2a57d3eff7-e457b5a2e4d86bd1-0',
    };
    const b3MultiCarrier = {
      [X_B3_TRACE_ID]: 'd4cda95b652f4a1592b449d5929fda1b',
      [X_B3_SPAN_ID]: '6e0c63257de34c92',
      [X_B3_SAMPLED]: '1',
    };
    const b3MixedCarrier = { ...b3SingleCarrier, ...b3MultiCarrier };

    it('extracts single header b3', () => {
      const context = propagator.extract(
        ROOT_CONTEXT,
        b3SingleCarrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = trace.getSpanContext(context);
      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'e457b5a2e4d86bd1',
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        isRemote: true,
        traceFlags: TraceFlags.NONE,
      });
    });

    it('extracts multi header b3', () => {
      const context = propagator.extract(
        ROOT_CONTEXT,
        b3MultiCarrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = trace.getSpanContext(context);
      assert.deepStrictEqual(extractedSpanContext, {
        spanId: '6e0c63257de34c92',
        traceId: 'd4cda95b652f4a1592b449d5929fda1b',
        isRemote: true,
        traceFlags: TraceFlags.SAMPLED,
      });
    });

    it('extracts single header over multi', () => {
      const context = propagator.extract(
        ROOT_CONTEXT,
        b3MixedCarrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = trace.getSpanContext(context);
      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'e457b5a2e4d86bd1',
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        isRemote: true,
        traceFlags: TraceFlags.NONE,
      });
    });
  });

  describe('fields()', () => {
    it('returns single header field by default', () => {
      const propagator = new B3Propagator();
      assert.deepStrictEqual(propagator.fields(), [B3_CONTEXT_HEADER]);
    });
    it('returns multi fields when configured to use multi fields', () => {
      const propagator = new B3Propagator({
        injectEncoding: B3InjectEncoding.MULTI_HEADER,
      });
      assert.deepStrictEqual(propagator.fields(), [
        X_B3_TRACE_ID,
        X_B3_SPAN_ID,
        X_B3_FLAGS,
        X_B3_SAMPLED,
        X_B3_PARENT_SPAN_ID,
      ]);
    });
  });
});
