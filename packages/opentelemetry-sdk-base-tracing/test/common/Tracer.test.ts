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
  createContextKey,
  INVALID_TRACEID,
  ROOT_CONTEXT,
  Sampler,
  SamplingDecision,
  SpanContext,
  trace,
  TraceFlags
} from '@opentelemetry/api';
import { getSpan } from '@opentelemetry/api/build/src/trace/context-utils';
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  InstrumentationLibrary,
  suppressTracing
} from '@opentelemetry/core';
import * as assert from 'assert';
import { BasicTracerProvider, Span, Tracer } from '../../src';
import { TestStackContextManager } from './export/TestStackContextManager';
import * as sinon from 'sinon';

describe('Tracer', () => {
  const tracerProvider = new BasicTracerProvider();
  const envSource = (typeof window !== 'undefined'
    ? window
    : process.env) as any;

  class TestSampler implements Sampler {
    shouldSample() {
      return {
        decision: SamplingDecision.RECORD_AND_SAMPLED,
        attributes: {
          testAttribute: 'foobar',
        },
      };
    }
  }

  beforeEach(() => {
    const contextManager = new TestStackContextManager().enable();
    context.setGlobalContextManager(contextManager);
  });

  afterEach(() => {
    context.disable();
    delete envSource.OTEL_TRACES_SAMPLER;
    delete envSource.OTEL_TRACES_SAMPLER_ARG;
  });

  it('should create a Tracer instance', () => {
    const tracer = new Tracer(
      { name: 'default', version: '0.0.1' },
      {},
      tracerProvider
    );
    assert.ok(tracer instanceof Tracer);
  });

  it('should use an ParentBasedSampler by default', () => {
    const tracer = new Tracer(
      { name: 'default', version: '0.0.1' },
      {},
      tracerProvider
    );
    assert.strictEqual(
      tracer['_sampler'].toString(),
      'ParentBased{root=AlwaysOnSampler, remoteParentSampled=AlwaysOnSampler, remoteParentNotSampled=AlwaysOffSampler, localParentSampled=AlwaysOnSampler, localParentNotSampled=AlwaysOffSampler}'
    );
  });

  it('should respect NO_RECORD sampling result', () => {
    const tracer = new Tracer(
      { name: 'default', version: '0.0.1' },
      { sampler: new AlwaysOffSampler() },
      tracerProvider
    );
    const span = tracer.startSpan('span1');
    assert.ok(!span.isRecording());
    span.end();
  });

  it('should respect RECORD_AND_SAMPLE sampling result', () => {
    const tracer = new Tracer(
      { name: 'default', version: '0.0.1' },
      { sampler: new AlwaysOnSampler() },
      tracerProvider
    );
    const span = tracer.startSpan('span2');
    assert.ok(span.isRecording());
    span.end();
  });

  it('should start a span with attributes in sampling result', () => {
    const tracer = new Tracer(
      { name: 'default', version: '0.0.1' },
      { sampler: new TestSampler() },
      tracerProvider
    );
    const span = tracer.startSpan('span3');
    assert.strictEqual((span as Span).attributes.testAttribute, 'foobar');
    span.end();
  });

  it('should have an instrumentationLibrary', () => {
    const tracer = new Tracer(
      { name: 'default', version: '0.0.1' },
      {},
      tracerProvider
    );

    const lib: InstrumentationLibrary = tracer.instrumentationLibrary;

    assert.strictEqual(lib.name, 'default');
    assert.strictEqual(lib.version, '0.0.1');
  });

  describe('when suppressTracing true', () => {
    const context = suppressTracing(ROOT_CONTEXT);

    it('should return cached no-op span ', done => {
      const tracer = new Tracer(
        { name: 'default', version: '0.0.1' },
        { sampler: new TestSampler() },
        tracerProvider
      );

      const span = tracer.startSpan('span3', undefined, context);

      assert.ok(!span.isRecording());
      span.end();

      done();
    });
  });

  it('should use traceId and spanId from parent', () => {
    const parent: SpanContext = {
      traceId: '00112233445566778899001122334455',
      spanId: '0011223344556677',
      traceFlags: TraceFlags.SAMPLED,
    };
    const tracer = new Tracer(
      { name: 'default', version: '0.0.1' },
      {},
      tracerProvider
    );
    const span = tracer.startSpan(
      'aSpan',
      undefined,
      trace.setSpanContext(ROOT_CONTEXT, parent)
    );
    assert.strictEqual((span as Span).parentSpanId, parent.spanId);
    assert.strictEqual(span.spanContext().traceId, parent.traceId);
  });

  it('should not use spanId from invalid parent', () => {
    const parent: SpanContext = {
      traceId: INVALID_TRACEID,
      spanId: '0011223344556677',
      traceFlags: TraceFlags.SAMPLED,
    };
    const tracer = new Tracer(
      { name: 'default', version: '0.0.1' },
      {},
      tracerProvider
    );
    const span = tracer.startSpan(
      'aSpan',
      undefined,
      trace.setSpanContext(ROOT_CONTEXT, parent)
    );
    assert.strictEqual((span as Span).parentSpanId, undefined);
  });

  it('should sample a trace when OTEL_TRACES_SAMPLER_ARG is unset', () => {
    envSource.OTEL_TRACES_SAMPLER = 'traceidratio';
    envSource.OTEL_TRACES_SAMPLER_ARG = '';
    const tracer = new Tracer(
      { name: 'default', version: '0.0.1' },
      {},
      tracerProvider
    );
    const span = tracer.startSpan('my-span');
    const context = span.spanContext();
    assert.strictEqual(context.traceFlags, TraceFlags.SAMPLED);
    span.end();
  });

  it('should not sample a trace when OTEL_TRACES_SAMPLER_ARG is out of range', () => {
    envSource.OTEL_TRACES_SAMPLER = 'traceidratio';
    envSource.OTEL_TRACES_SAMPLER_ARG = '2';
    const tracer = new Tracer(
      { name: 'default', version: '0.0.1' },
      {},
      tracerProvider
    );
    const span = tracer.startSpan('my-span');
    const context = span.spanContext();
    assert.strictEqual(context.traceFlags, TraceFlags.SAMPLED);
    span.end();
  });

  it('should not sample a trace when OTEL_TRACES_SAMPLER_ARG is 0', () => {
    envSource.OTEL_TRACES_SAMPLER = 'traceidratio';
    envSource.OTEL_TRACES_SAMPLER_ARG = '0';
    const tracer = new Tracer(
      { name: 'default', version: '0.0.1' },
      {},
      tracerProvider
    );
    const span = tracer.startSpan('my-span');
    const context = span.spanContext();
    assert.strictEqual(context.traceFlags, TraceFlags.NONE);
    span.end();
  });

  it('should start an active span with name and function args', () => {
    const tracer = new Tracer(
      { name: 'default', version: '0.0.1' },
      { sampler: new TestSampler() },
      tracerProvider
    );

    const spy = sinon.spy(tracer, "startSpan");

    assert.strictEqual(tracer.startActiveSpan('my-span', span => {
      try {
        assert(spy.calledWith('my-span'))
        assert.strictEqual(getSpan(context.active()), span)
        return 1
      } finally {
        span.end();
      }
    }), 1);
  });

  it('should start an active span with name, options and function args', () => {

    const tracer = new Tracer(
      { name: 'default', version: '0.0.1' },
      { sampler: new TestSampler() },
      tracerProvider
    );

    const spy = sinon.spy(tracer, "startSpan");

    assert.strictEqual(tracer.startActiveSpan('my-span', {attributes: {foo: 'bar'}}, span => {
      try {
        assert(spy.calledWith('my-span', {attributes: {foo: 'bar'}}))
        assert.strictEqual(getSpan(context.active()), span)
        return 1
      } finally {
        span.end();
      }
    }), 1);
  });

  it('should start an active span with name, options, context and function args', () => {
    const tracer = new Tracer(
      { name: 'default', version: '0.0.1' },
      { sampler: new TestSampler() },
      tracerProvider
    );

    const ctxKey = createContextKey('foo');

    const ctx = context.active().setValue(ctxKey, 'bar')

    const spy = sinon.spy(tracer, "startSpan");

    assert.strictEqual(tracer.startActiveSpan('my-span', {attributes: {foo: 'bar'}}, ctx, span => {
      try {
        assert(spy.calledWith('my-span', {attributes: {foo: 'bar'}}, ctx))
        assert.strictEqual(getSpan(context.active()), span)
        assert.strictEqual(ctx.getValue(ctxKey), 'bar')
        return 1
      } finally {
        span.end();
      }
    }), 1);
  });
});
