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
  StatusCode,
  Exception,
  LinkContext,
  ROOT_CONTEXT,
  SpanContext,
  SpanKind,
  TraceFlags,
} from '@opentelemetry/api';
import {
  hrTime,
  hrTimeDuration,
  hrTimeToMilliseconds,
  hrTimeToNanoseconds,
  NoopLogger,
} from '@opentelemetry/core';
import { ExceptionAttribute } from '@opentelemetry/semantic-conventions';
import * as assert from 'assert';
import sinon = require('sinon');
import { BasicTracerProvider, Span, SpanProcessor } from '../src';

const performanceTimeOrigin = hrTime();

describe('Span', () => {
  const tracer = new BasicTracerProvider({
    logger: new NoopLogger(),
  }).getTracer('default');
  const name = 'span1';
  const spanContext: SpanContext = {
    traceId: 'd4cda95b652f4a1592b449d5929fda1b',
    spanId: '6e0c63257de34c92',
    traceFlags: TraceFlags.SAMPLED,
  };
  const linkContext: LinkContext = {
    traceId: 'e4cda95b652f4a1592b449d5929fda1b',
    spanId: '7e0c63257de34c92',
  };

  it('should create a Span instance', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.SERVER
    );
    assert.ok(span instanceof Span);
    span.end();
  });

  it('should have valid startTime', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.SERVER
    );
    assert.ok(
      hrTimeToMilliseconds(span.startTime) >
        hrTimeToMilliseconds(performanceTimeOrigin)
    );
  });

  it('should have valid endTime', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.SERVER
    );
    span.end();
    assert.ok(
      hrTimeToNanoseconds(span.endTime) >= hrTimeToNanoseconds(span.startTime),
      'end time must be bigger or equal start time'
    );

    assert.ok(
      hrTimeToMilliseconds(span.endTime) >
        hrTimeToMilliseconds(performanceTimeOrigin),
      'end time must be bigger than time origin'
    );
  });

  it('should have a duration', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.SERVER
    );
    span.end();
    assert.ok(hrTimeToNanoseconds(span.duration) >= 0);
  });

  it('should have valid event.time', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.SERVER
    );
    span.addEvent('my-event');
    assert.ok(
      hrTimeToMilliseconds(span.events[0].time) >
        hrTimeToMilliseconds(performanceTimeOrigin)
    );
  });

  it('should have an entered time for event', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.SERVER,
      undefined,
      [],
      0
    );
    const timeMS = 123;
    const spanStartTime = hrTimeToMilliseconds(span.startTime);
    const eventTime = spanStartTime + timeMS;

    span.addEvent('my-event', undefined, eventTime);

    const diff = hrTimeDuration(span.startTime, span.events[0].time);
    assert.strictEqual(hrTimeToMilliseconds(diff), 123);
  });

  describe('when 2nd param is "TimeInput" type', () => {
    it('should have an entered time for event - ', () => {
      const span = new Span(
        tracer,
        ROOT_CONTEXT,
        name,
        spanContext,
        SpanKind.SERVER,
        undefined,
        [],
        0
      );
      const timeMS = 123;
      const spanStartTime = hrTimeToMilliseconds(span.startTime);
      const eventTime = spanStartTime + timeMS;

      span.addEvent('my-event', eventTime);

      const diff = hrTimeDuration(span.startTime, span.events[0].time);
      assert.strictEqual(hrTimeToMilliseconds(diff), 123);
    });
  });

  it('should get the span context of span', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.CLIENT
    );
    const context = span.context();
    assert.strictEqual(context.traceId, spanContext.traceId);
    assert.strictEqual(context.traceFlags, TraceFlags.SAMPLED);
    assert.strictEqual(context.traceState, undefined);
    assert.ok(context.spanId.match(/[a-f0-9]{16}/));
    assert.ok(span.isRecording());
    span.end();
  });

  describe('isRecording', () => {
    it('should return true when span is not ended', () => {
      const span = new Span(
        tracer,
        ROOT_CONTEXT,
        name,
        spanContext,
        SpanKind.CLIENT
      );
      assert.ok(span.isRecording());
      span.end();
    });
    it('should return false when span is ended', () => {
      const span = new Span(
        tracer,
        ROOT_CONTEXT,
        name,
        spanContext,
        SpanKind.CLIENT
      );
      span.end();
      assert.ok(span.isRecording() === false);
    });
  });

  it('should set an attribute', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.CLIENT
    );

    span.setAttribute('string', 'string');
    span.setAttribute('number', 0);
    span.setAttribute('bool', true);
    span.setAttribute('array<string>', ['str1', 'str2']);
    span.setAttribute('array<number>', [1, 2]);
    span.setAttribute('array<bool>', [true, false]);

    //@ts-expect-error
    span.setAttribute('object', { foo: 'bar' });
    //@ts-expect-error
    span.setAttribute('non-homogeneous-array', [0, '']);

    assert.deepStrictEqual(span.attributes, {
      string: 'string',
      number: 0,
      bool: true,
      'array<string>': ['str1', 'str2'],
      'array<number>': [1, 2],
      'array<bool>': [true, false],
    });
  });

  it('should overwrite attributes', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.CLIENT
    );

    span.setAttribute('overwrite', 'initial value');
    span.setAttribute('overwrite', 'overwritten value');

    assert.deepStrictEqual(span.attributes, {
      overwrite: 'overwritten value',
    });
  });

  it('should set attributes', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.CLIENT
    );

    span.setAttributes({
      string: 'string',
      number: 0,
      bool: true,
      'array<string>': ['str1', 'str2'],
      'array<number>': [1, 2],
      'array<bool>': [true, false],
      //@ts-expect-error
      object: { foo: 'bar' },
      //@ts-expect-error
      'non-homogeneous-array': [0, ''],
    });

    assert.deepStrictEqual(span.attributes, {
      string: 'string',
      number: 0,
      bool: true,
      'array<string>': ['str1', 'str2'],
      'array<number>': [1, 2],
      'array<bool>': [true, false],
    });
  });

  it('should set an event', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.CLIENT
    );
    span.addEvent('sent');
    span.addEvent('rev', { attr1: 'value', attr2: 123, attr3: true });
    span.end();
  });

  it('should set a link', () => {
    const spanContext: SpanContext = {
      traceId: 'a3cda95b652f4a1592b449d5929fda1b',
      spanId: '5e0c63257de34c92',
      traceFlags: TraceFlags.SAMPLED,
    };
    const linkContext: LinkContext = {
      traceId: 'b3cda95b652f4a1592b449d5929fda1b',
      spanId: '6e0c63257de34c92',
    };
    const attributes = { attr1: 'value', attr2: 123, attr3: true };
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.CLIENT,
      '12345',
      [{ context: linkContext }, { context: linkContext, attributes }]
    );
    span.end();
  });

  it('should drop extra links, attributes and events', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.CLIENT
    );
    for (let i = 0; i < 150; i++) {
      span.setAttribute('foo' + i, 'bar' + i);
      span.addEvent('sent' + i);
    }
    span.end();

    assert.strictEqual(span.events.length, 128);
    assert.strictEqual(Object.keys(span.attributes).length, 32);
    assert.strictEqual(span.events[span.events.length - 1].name, 'sent149');
    assert.strictEqual(span.attributes['foo0'], undefined);
    assert.strictEqual(span.attributes['foo149'], 'bar149');
  });

  it('should truncate attribute values exceeding length limit', () => {
    const tracerWithLimit = new BasicTracerProvider({
      logger: new NoopLogger(),
      traceParams: {
        spanAttributeValueSizeLimit: 100,
      },
    }).getTracer('default');

    const spanWithLimit = new Span(
      tracerWithLimit,
      name,
      spanContext,
      SpanKind.CLIENT
    );
    const spanWithoutLimit = new Span(
      tracer,
      name,
      spanContext,
      SpanKind.CLIENT
    );

    spanWithLimit.setAttribute('attr under limit', 'a'.repeat(100));
    assert.strictEqual(
      spanWithLimit.attributes['attr under limit'],
      'a'.repeat(100)
    );
    spanWithoutLimit.setAttribute('attr under limit', 'a'.repeat(100));
    assert.strictEqual(
      spanWithoutLimit.attributes['attr under limit'],
      'a'.repeat(100)
    );

    spanWithLimit.setAttribute('attr over limit', 'b'.repeat(101));
    assert.strictEqual(
      spanWithLimit.attributes['attr over limit'],
      'b'.repeat(100)
    );
    spanWithoutLimit.setAttribute('attr over limit', 'b'.repeat(101));
    assert.strictEqual(
      spanWithoutLimit.attributes['attr over limit'],
      'b'.repeat(101)
    );
  });

  it('should warn once when truncating attribute values exceeding length limit', () => {
    const logger = new NoopLogger();
    const loggerWarnSpy = sinon.spy(logger, 'warn');

    const tracerWithLimit = new BasicTracerProvider({
      logger,
      traceParams: {
        spanAttributeValueSizeLimit: 100,
      },
    }).getTracer('default');

    const spanWithLimit = new Span(
      tracerWithLimit,
      name,
      spanContext,
      SpanKind.CLIENT
    );

    spanWithLimit.setAttribute('longAttr', 'b'.repeat(100));
    assert(!loggerWarnSpy.called);

    spanWithLimit.setAttribute('longAttr', 'b'.repeat(101));
    assert(
      loggerWarnSpy.withArgs('Span attribute value truncated at key: longAttr.')
        .calledOnce
    );

    spanWithLimit.setAttribute('longAttr', 'c'.repeat(102));
    assert(
      loggerWarnSpy.withArgs('Span attribute value truncated at key: longAttr.')
        .calledOnce
    );

    assert.strictEqual(spanWithLimit.attributes.longAttr, 'c'.repeat(100));
  });

  it('should set an error status', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.CLIENT
    );
    span.setStatus({
      code: StatusCode.ERROR,
      message: 'This is an error',
    });
    span.end();
  });

  it('should return ReadableSpan', () => {
    const parentId = '5c1c63257de34c67';
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      'my-span',
      spanContext,
      SpanKind.INTERNAL,
      parentId
    );

    assert.strictEqual(span.name, 'my-span');
    assert.strictEqual(span.kind, SpanKind.INTERNAL);
    assert.strictEqual(span.parentSpanId, parentId);
    assert.strictEqual(span.spanContext.traceId, spanContext.traceId);
    assert.deepStrictEqual(span.status, {
      code: StatusCode.UNSET,
    });
    assert.deepStrictEqual(span.attributes, {});
    assert.deepStrictEqual(span.links, []);
    assert.deepStrictEqual(span.events, []);

    assert.ok(span.instrumentationLibrary);
    const { name, version } = span.instrumentationLibrary;
    assert.strictEqual(name, 'default');
    assert.strictEqual(version, '*');
  });

  it('should return ReadableSpan with attributes', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      'my-span',
      spanContext,
      SpanKind.CLIENT
    );
    span.setAttribute('attr1', 'value1');
    assert.deepStrictEqual(span.attributes, { attr1: 'value1' });

    span.setAttributes({ attr2: 123, attr1: false });
    assert.deepStrictEqual(span.attributes, {
      attr1: false,
      attr2: 123,
    });

    span.end();
    // shouldn't add new attribute
    span.setAttribute('attr3', 'value3');
    assert.deepStrictEqual(span.attributes, {
      attr1: false,
      attr2: 123,
    });
  });

  it('should return ReadableSpan with links', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      'my-span',
      spanContext,
      SpanKind.CLIENT,
      undefined,
      [
        { context: linkContext },
        {
          context: linkContext,
          attributes: { attr1: 'value', attr2: 123, attr3: true },
        },
      ]
    );
    assert.strictEqual(span.links.length, 2);
    assert.deepStrictEqual(span.links, [
      {
        context: linkContext,
      },
      {
        attributes: { attr1: 'value', attr2: 123, attr3: true },
        context: linkContext,
      },
    ]);

    span.end();
  });

  it('should return ReadableSpan with events', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      'my-span',
      spanContext,
      SpanKind.CLIENT
    );
    span.addEvent('sent');
    assert.strictEqual(span.events.length, 1);
    const [event] = span.events;
    assert.deepStrictEqual(event.name, 'sent');
    assert.ok(!event.attributes);
    assert.ok(event.time[0] > 0);

    span.addEvent('rev', { attr1: 'value', attr2: 123, attr3: true });
    assert.strictEqual(span.events.length, 2);
    const [event1, event2] = span.events;
    assert.deepStrictEqual(event1.name, 'sent');
    assert.ok(!event1.attributes);
    assert.ok(event1.time[0] > 0);
    assert.deepStrictEqual(event2.name, 'rev');
    assert.deepStrictEqual(event2.attributes, {
      attr1: 'value',
      attr2: 123,
      attr3: true,
    });
    assert.ok(event2.time[0] > 0);

    span.end();
    // shouldn't add new event
    span.addEvent('sent');
    assert.strictEqual(span.events.length, 2);
  });

  it('should return ReadableSpan with new status', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.CLIENT
    );
    span.setStatus({
      code: StatusCode.ERROR,
      message: 'This is an error',
    });
    assert.strictEqual(span.status.code, StatusCode.ERROR);
    assert.strictEqual(span.status.message, 'This is an error');
    span.end();

    // shouldn't update status
    span.setStatus({
      code: StatusCode.OK,
      message: 'OK',
    });
    assert.strictEqual(span.status.code, StatusCode.ERROR);
  });

  it('should only end a span once', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.SERVER
    );
    const endTime = Date.now();
    span.end(endTime);
    span.end(endTime + 10);
    assert.deepStrictEqual(span.endTime[0], Math.trunc(endTime / 1000));
  });

  it('should update name', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.SERVER
    );
    span.updateName('foo-span');
    span.end();

    // shouldn't update name
    span.updateName('bar-span');
    assert.strictEqual(span.name, 'foo-span');
  });

  it('should have ended', () => {
    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      name,
      spanContext,
      SpanKind.SERVER
    );
    assert.strictEqual(span.ended, false);
    span.end();
    assert.strictEqual(span.ended, true);
  });

  describe('span processor', () => {
    it('should call onStart synchronously when span is started', () => {
      let started = false;
      const processor: SpanProcessor = {
        onStart: () => {
          started = true;
        },
        forceFlush: () => Promise.resolve(),
        onEnd() {},
        shutdown: () => Promise.resolve(),
      };

      const provider = new BasicTracerProvider({
        logger: new NoopLogger(),
      });

      provider.addSpanProcessor(processor);

      provider.getTracer('default').startSpan('test');
      assert.ok(started);
    });

    it('should call onEnd synchronously when span is ended', () => {
      let ended = false;
      const processor: SpanProcessor = {
        onStart: () => {},
        forceFlush: () => Promise.resolve(),
        onEnd() {
          ended = true;
        },
        shutdown: () => Promise.resolve(),
      };

      const provider = new BasicTracerProvider({
        logger: new NoopLogger(),
      });

      provider.addSpanProcessor(processor);

      provider.getTracer('default').startSpan('test').end();
      assert.ok(ended);
    });

    it('should call onStart with a writeable span', () => {
      const processor: SpanProcessor = {
        onStart: span => {
          span.setAttribute('attr', true);
        },
        forceFlush: () => Promise.resolve(),
        onEnd() {},
        shutdown: () => Promise.resolve(),
      };

      const provider = new BasicTracerProvider({
        logger: new NoopLogger(),
      });

      provider.addSpanProcessor(processor);

      const s = provider.getTracer('default').startSpan('test') as Span;
      assert.ok(s.attributes.attr);
    });
  });

  describe('recordException', () => {
    const invalidExceptions: any[] = [
      1,
      null,
      undefined,
      { foo: 'bar' },
      { stack: 'bar' },
      ['a', 'b', 'c'],
    ];

    invalidExceptions.forEach(key => {
      describe(`when exception is (${JSON.stringify(key)})`, () => {
        it('should NOT record an exception', () => {
          const span = new Span(
            tracer,
            ROOT_CONTEXT,
            name,
            spanContext,
            SpanKind.CLIENT
          );
          assert.strictEqual(span.events.length, 0);
          span.recordException(key);
          assert.strictEqual(span.events.length, 0);
        });
      });
    });

    describe('when exception type is "string"', () => {
      let error: Exception;
      beforeEach(() => {
        error = 'boom';
      });
      it('should record an exception', () => {
        const span = new Span(
          tracer,
          ROOT_CONTEXT,
          name,
          spanContext,
          SpanKind.CLIENT
        );
        assert.strictEqual(span.events.length, 0);
        span.recordException(error);

        const event = span.events[0];
        assert.strictEqual(event.name, 'exception');
        assert.deepStrictEqual(event.attributes, {
          'exception.message': 'boom',
        });
        assert.ok(event.time[0] > 0);
      });
    });

    const errorsObj = [
      {
        description: 'code',
        obj: { code: 'Error', message: 'boom', stack: 'bar' },
      },
      {
        description: 'name',
        obj: { name: 'Error', message: 'boom', stack: 'bar' },
      },
    ];
    errorsObj.forEach(errorObj => {
      describe(`when exception type is an object with ${errorObj.description}`, () => {
        const error: Exception = errorObj.obj;
        it('should record an exception', () => {
          const span = new Span(
            tracer,
            ROOT_CONTEXT,
            name,
            spanContext,
            SpanKind.CLIENT
          );
          assert.strictEqual(span.events.length, 0);
          span.recordException(error);

          const event = span.events[0];
          assert.ok(event.time[0] > 0);
          assert.strictEqual(event.name, 'exception');

          assert.ok(event.attributes);

          const type = event.attributes[ExceptionAttribute.TYPE];
          const message = event.attributes[ExceptionAttribute.MESSAGE];
          const stacktrace = String(
            event.attributes[ExceptionAttribute.STACKTRACE]
          );
          assert.strictEqual(type, 'Error');
          assert.strictEqual(message, 'boom');
          assert.strictEqual(stacktrace, 'bar');
        });
      });
    });

    describe('when time is provided', () => {
      it('should record an exception with provided time', () => {
        const span = new Span(
          tracer,
          ROOT_CONTEXT,
          name,
          spanContext,
          SpanKind.CLIENT
        );
        assert.strictEqual(span.events.length, 0);
        span.recordException('boom', [0, 123]);
        const event = span.events[0];
        assert.deepStrictEqual(event.time, [0, 123]);
      });
    });
  });
});
