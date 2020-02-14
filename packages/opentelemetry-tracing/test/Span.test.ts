/*!
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
import {
  SpanKind,
  CanonicalCode,
  TraceFlags,
  SpanContext,
} from '@opentelemetry/api';
import { BasicTracerProvider, Span } from '../src';
import {
  hrTime,
  hrTimeToNanoseconds,
  hrTimeToMilliseconds,
  NoopLogger,
  hrTimeDuration,
} from '@opentelemetry/core';

const performanceTimeOrigin = hrTime();

describe('Span', () => {
  const tracer = new BasicTracerProvider({
    logger: new NoopLogger(),
  }).getTracer('default');
  const name = 'span1';
  const spanContext: SpanContext = {
    traceId: new Uint8Array([0xd4, 0xcd, 0xa9, 0x5b, 0x65, 0x2f, 0x4a, 0x15, 0x92, 0xb4, 0x49, 0xd5, 0x92, 0x9f, 0xda, 0x1b]),
    spanId: new Uint8Array([0x6e, 0x0c, 0x63, 0x25, 0x7d, 0xe3, 0x4c, 0x92]),
    traceFlags: TraceFlags.SAMPLED,
  };

  it('should create a Span instance', () => {
    const span = new Span(tracer, name, spanContext, SpanKind.SERVER);
    assert.ok(span instanceof Span);
    span.end();
  });

  it('should have valid startTime', () => {
    const span = new Span(tracer, name, spanContext, SpanKind.SERVER);
    assert.ok(
      hrTimeToMilliseconds(span.startTime) >
        hrTimeToMilliseconds(performanceTimeOrigin)
    );
  });

  it('should have valid endTime', () => {
    const span = new Span(tracer, name, spanContext, SpanKind.SERVER);
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
    const span = new Span(tracer, name, spanContext, SpanKind.SERVER);
    span.end();
    assert.ok(hrTimeToNanoseconds(span.duration) >= 0);
  });

  it('should have valid event.time', () => {
    const span = new Span(tracer, name, spanContext, SpanKind.SERVER);
    span.addEvent('my-event');
    assert.ok(
      hrTimeToMilliseconds(span.events[0].time) >
        hrTimeToMilliseconds(performanceTimeOrigin)
    );
  });

  it('should have an entered time for event', () => {
    const span = new Span(
      tracer,
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
    const span = new Span(tracer, name, spanContext, SpanKind.CLIENT);
    const context = span.context();
    assert.strictEqual(context.traceId, spanContext.traceId);
    assert.strictEqual(context.traceFlags, TraceFlags.SAMPLED);
    assert.strictEqual(context.traceState, undefined);
    assert.strictEqual(context.spanId.byteLength, 8);
    assert.ok(span.isRecording());
    span.end();
  });

  it('should return true when isRecording:true', () => {
    const span = new Span(tracer, name, spanContext, SpanKind.CLIENT);
    assert.ok(span.isRecording());
    span.end();
  });

  it('should set an attribute', () => {
    const span = new Span(tracer, name, spanContext, SpanKind.CLIENT);

    ['String', 'Number', 'Boolean'].forEach(attType => {
      span.setAttribute('testKey' + attType, 'testValue' + attType);
    });
    span.setAttribute('object', { foo: 'bar' });
    span.end();
  });

  it('should set an event', () => {
    const span = new Span(tracer, name, spanContext, SpanKind.CLIENT);
    span.addEvent('sent');
    span.addEvent('rev', { attr1: 'value', attr2: 123, attr3: true });
    span.end();
  });

  it('should set a link', () => {
    const spanContext: SpanContext = {
      traceId: new Uint8Array([0xa3, 0xcd, 0xa9, 0x5b, 0x65, 0x2f, 0x4a, 0x15, 0x92, 0xb4, 0x49, 0xd5, 0x92, 0x9f, 0xda, 0x1b]),
      spanId: new Uint8Array([0x5e, 0x0c, 0x63, 0x25, 0x7d, 0xe3, 0x4c, 0x92]),
      traceFlags: TraceFlags.SAMPLED,
    };
    const attributes = { attr1: 'value', attr2: 123, attr3: true };
    const span = new Span(tracer, name, spanContext, SpanKind.CLIENT, new Uint8Array([0x12, 0x34, 0x50]), [
      { spanContext },
      { spanContext, attributes },
    ]);
    span.end();
  });

  it('should drop extra links, attributes and events', () => {
    const span = new Span(tracer, name, spanContext, SpanKind.CLIENT);
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

  it('should set an error status', () => {
    const span = new Span(tracer, name, spanContext, SpanKind.CLIENT);
    span.setStatus({
      code: CanonicalCode.PERMISSION_DENIED,
      message: 'This is an error',
    });
    span.end();
  });

  it('should return ReadableSpan', () => {
    const parentId = new Uint8Array([0x5c, 0x1c, 0x63, 0x25, 0x7d, 0xe3, 0x4c, 0x67]);
    const span = new Span(
      tracer,
      'my-span',
      spanContext,
      SpanKind.INTERNAL,
      parentId
    );

    const readableSpan = span.toReadableSpan();
    assert.strictEqual(readableSpan.name, 'my-span');
    assert.strictEqual(readableSpan.kind, SpanKind.INTERNAL);
    assert.strictEqual(readableSpan.parentSpanId, parentId);
    assert.strictEqual(readableSpan.spanContext.traceId, spanContext.traceId);
    assert.deepStrictEqual(readableSpan.status, {
      code: CanonicalCode.OK,
    });
    assert.deepStrictEqual(readableSpan.attributes, {});
    assert.deepStrictEqual(readableSpan.links, []);
    assert.deepStrictEqual(readableSpan.events, []);
  });

  it('should return ReadableSpan with attributes', () => {
    const span = new Span(tracer, 'my-span', spanContext, SpanKind.CLIENT);
    span.setAttribute('attr1', 'value1');
    let readableSpan = span.toReadableSpan();
    assert.deepStrictEqual(readableSpan.attributes, { attr1: 'value1' });

    span.setAttributes({ attr2: 123, attr1: false });
    readableSpan = span.toReadableSpan();
    assert.deepStrictEqual(readableSpan.attributes, {
      attr1: false,
      attr2: 123,
    });

    span.end();
    // shouldn't add new attribute
    span.setAttribute('attr3', 'value3');
    readableSpan = span.toReadableSpan();
    assert.deepStrictEqual(readableSpan.attributes, {
      attr1: false,
      attr2: 123,
    });
  });

  it('should return ReadableSpan with links', () => {
    const span = new Span(
      tracer,
      'my-span',
      spanContext,
      SpanKind.CLIENT,
      undefined,
      [
        { spanContext },
        {
          spanContext,
          attributes: { attr1: 'value', attr2: 123, attr3: true },
        },
      ]
    );
    const readableSpan = span.toReadableSpan();
    assert.strictEqual(readableSpan.links.length, 2);
    assert.deepStrictEqual(readableSpan.links, [
      {
        spanContext,
      },
      {
        attributes: { attr1: 'value', attr2: 123, attr3: true },
        spanContext,
      },
    ]);

    span.end();
  });

  it('should return ReadableSpan with events', () => {
    const span = new Span(tracer, 'my-span', spanContext, SpanKind.CLIENT);
    span.addEvent('sent');
    let readableSpan = span.toReadableSpan();
    assert.strictEqual(readableSpan.events.length, 1);
    const [event] = readableSpan.events;
    assert.deepStrictEqual(event.name, 'sent');
    assert.ok(!event.attributes);
    assert.ok(event.time[0] > 0);

    span.addEvent('rev', { attr1: 'value', attr2: 123, attr3: true });
    readableSpan = span.toReadableSpan();
    assert.strictEqual(readableSpan.events.length, 2);
    const [event1, event2] = readableSpan.events;
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
    assert.strictEqual(readableSpan.events.length, 2);
    readableSpan = span.toReadableSpan();
    assert.strictEqual(readableSpan.events.length, 2);
  });

  it('should return ReadableSpan with new status', () => {
    const span = new Span(tracer, name, spanContext, SpanKind.CLIENT);
    span.setStatus({
      code: CanonicalCode.PERMISSION_DENIED,
      message: 'This is an error',
    });
    const readableSpan = span.toReadableSpan();
    assert.strictEqual(
      readableSpan.status.code,
      CanonicalCode.PERMISSION_DENIED
    );
    assert.strictEqual(readableSpan.status.message, 'This is an error');
    span.end();

    // shouldn't update status
    span.setStatus({
      code: CanonicalCode.OK,
      message: 'OK',
    });
    assert.strictEqual(span.status.code, CanonicalCode.PERMISSION_DENIED);
  });

  it('should only end a span once', () => {
    const span = new Span(tracer, name, spanContext, SpanKind.SERVER);
    const endTime = Date.now();
    span.end(endTime);
    span.end(endTime + 10);
    assert.deepStrictEqual(span.endTime[0], Math.trunc(endTime / 1000));
  });

  it('should update name', () => {
    const span = new Span(tracer, name, spanContext, SpanKind.SERVER);
    span.updateName('foo-span');
    span.end();

    // shouldn't update name
    span.updateName('bar-span');
    assert.strictEqual(span.name, 'foo-span');
  });
});
