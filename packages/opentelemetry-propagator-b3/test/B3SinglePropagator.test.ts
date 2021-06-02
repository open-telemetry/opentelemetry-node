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
  SpanContext,
  TraceFlags,
  trace,
} from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';
import * as assert from 'assert';
import { B3SinglePropagator } from '../src/B3SinglePropagator';
import { B3_DEBUG_FLAG_KEY } from '../src/common';
import { B3_CONTEXT_HEADER } from '../src/constants';

describe('B3SinglePropagator', () => {
  const propagator = new B3SinglePropagator();
  let carrier: { [key: string]: unknown };

  beforeEach(() => {
    carrier = {};
  });

  describe('.inject()', () => {
    it('injects context with sampled trace flags', () => {
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

    it('injects context with unspecified trace flags', () => {
      const spanContext: SpanContext = {
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        spanId: 'e457b5a2e4d86bd1',
        traceFlags: TraceFlags.NONE,
      };

      propagator.inject(
        trace.setSpanContext(ROOT_CONTEXT, spanContext),
        carrier,
        defaultTextMapSetter
      );

      const expected = '80f198ee56343ba864fe8b2a57d3eff7-e457b5a2e4d86bd1-0';
      assert.strictEqual(carrier[B3_CONTEXT_HEADER], expected);
    });

    it('injects debug flag when present', () => {
      const spanContext: SpanContext = {
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        spanId: 'e457b5a2e4d86bd1',
        traceFlags: TraceFlags.SAMPLED,
      };

      const context = ROOT_CONTEXT.setValue(B3_DEBUG_FLAG_KEY, 'd');

      propagator.inject(
        trace.setSpanContext(context, spanContext),
        carrier,
        defaultTextMapSetter
      );

      const expected = '80f198ee56343ba864fe8b2a57d3eff7-e457b5a2e4d86bd1-d';
      assert.strictEqual(carrier[B3_CONTEXT_HEADER], expected);
    });

    it('no-ops if traceid invalid', () => {
      const spanContext: SpanContext = {
        traceId: INVALID_TRACEID,
        spanId: 'e457b5a2e4d86bd1',
        traceFlags: TraceFlags.SAMPLED,
      };

      propagator.inject(
        trace.setSpanContext(ROOT_CONTEXT, spanContext),
        carrier,
        defaultTextMapSetter
      );

      assert.strictEqual(carrier[B3_CONTEXT_HEADER], undefined);
    });

    it('no-ops if spanid invalid', () => {
      const spanContext: SpanContext = {
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        spanId: INVALID_SPANID,
        traceFlags: TraceFlags.SAMPLED,
      };

      propagator.inject(
        trace.setSpanContext(ROOT_CONTEXT, spanContext),
        carrier,
        defaultTextMapSetter
      );

      assert.strictEqual(carrier[B3_CONTEXT_HEADER], undefined);
    });

    it('does not inject if instrumentation is suppressed', () => {
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

  describe('.extract', () => {
    it('extracts context with traceid, spanid, sampling flag, parent spanid', () => {
      carrier = {
        [B3_CONTEXT_HEADER]:
          '80f198ee56343ba864fe8b2a57d3eff7-e457b5a2e4d86bd1-1-05e3ac9a4f6e3b90',
      };

      const context = propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = trace.getSpanContext(context);
      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'e457b5a2e4d86bd1',
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        isRemote: true,
        traceFlags: TraceFlags.SAMPLED,
      });
    });

    it('extracts context with traceid, spanid, sampling flag', () => {
      carrier = {
        [B3_CONTEXT_HEADER]:
          '80f198ee56343ba864fe8b2a57d3eff7-e457b5a2e4d86bd1-1',
      };

      const context = propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = trace.getSpanContext(context);
      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'e457b5a2e4d86bd1',
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        isRemote: true,
        traceFlags: TraceFlags.SAMPLED,
      });
    });

    it('extracts context with traceid, spanid', () => {
      carrier = {
        [B3_CONTEXT_HEADER]:
          '80f198ee56343ba864fe8b2a57d3eff7-e457b5a2e4d86bd1',
      };

      const context = propagator.extract(
        ROOT_CONTEXT,
        carrier,
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

    it('converts 8-byte traceid', () => {
      carrier = {
        [B3_CONTEXT_HEADER]: '4aaba1a52cf8ee09-e457b5a2e4d86bd1',
      };

      const context = propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = trace.getSpanContext(context);
      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'e457b5a2e4d86bd1',
        traceId: '00000000000000004aaba1a52cf8ee09',
        isRemote: true,
        traceFlags: TraceFlags.NONE,
      });
    });

    it('converts debug flag to sampled', () => {
      carrier = {
        [B3_CONTEXT_HEADER]:
          '80f198ee56343ba864fe8b2a57d3eff7-e457b5a2e4d86bd1-d',
      };

      const context = propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = trace.getSpanContext(context);
      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'e457b5a2e4d86bd1',
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        isRemote: true,
        traceFlags: TraceFlags.SAMPLED,
      });
      assert.strictEqual('d', context.getValue(B3_DEBUG_FLAG_KEY));
    });

    it('handles malformed traceid', () => {
      carrier = {
        [B3_CONTEXT_HEADER]: 'abc123-e457b5a2e4d86bd1',
      };

      const context = propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = trace.getSpanContext(context);
      assert.deepStrictEqual(undefined, extractedSpanContext);
    });

    it('handles malformed spanid', () => {
      carrier = {
        [B3_CONTEXT_HEADER]: '80f198ee56343ba864fe8b2a57d3eff7-abc123',
      };

      const context = propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = trace.getSpanContext(context);
      assert.deepStrictEqual(undefined, extractedSpanContext);
    });

    it('handles invalid traceid', () => {
      carrier = {
        [B3_CONTEXT_HEADER]: `${INVALID_TRACEID}-e457b5a2e4d86bd1`,
      };

      const context = propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = trace.getSpanContext(context);
      assert.deepStrictEqual(undefined, extractedSpanContext);
    });

    it('handles invalid spanid', () => {
      carrier = {
        [B3_CONTEXT_HEADER]: `80f198ee56343ba864fe8b2a57d3eff7-${INVALID_SPANID}`,
      };

      const context = propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = trace.getSpanContext(context);
      assert.deepStrictEqual(undefined, extractedSpanContext);
    });
  });
});
