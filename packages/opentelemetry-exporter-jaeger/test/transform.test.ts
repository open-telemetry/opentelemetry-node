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
import { spanToThrift } from '../src/transform';
import { ReadableSpan } from '@opentelemetry/basic-tracer';
import * as types from '@opentelemetry/types';
import { ThriftUtils, Utils, ThriftReferenceType } from '../src/types';

describe('transform', () => {
  const spanContext = {
    traceId: 'd4cda95b652f4a1592b449d5929fda1b',
    spanId: '6e0c63257de34c92',
  };

  describe('spanToThrift', () => {
    it('should convert an OpenTelemetry span to a Thrift', () => {
      const readableSpan: ReadableSpan = {
        name: 'my-span',
        kind: types.SpanKind.INTERNAL,
        spanContext,
        startTime: 1566156729709,
        endTime: 1566156729709 + 2000,
        status: {
          code: types.CanonicalCode.OK,
        },
        attributes: {
          testBool: true,
          testString: 'test',
          testNum: 3.142,
        },
        links: [
          {
            spanContext: {
              traceId: 'a4cda95b652f4a1592b449d5929fda1b',
              spanId: '3e0c63257de34c92',
            },
            attributes: {
              testBool: true,
              testString: 'test',
              testNum: 3.142,
            },
          },
        ],
        events: [
          {
            name: 'something happened',
            attributes: {
              error: true,
            },
            time: 1566156729709 + 100,
          },
        ],
      };

      const thriftSpan = spanToThrift(readableSpan);
      const result = ThriftUtils._thrift.Span.rw.toBuffer(thriftSpan);
      assert.strictEqual(result.err, null);
      assert.deepStrictEqual(thriftSpan.operationName, 'my-span');
      assert.deepStrictEqual(
        thriftSpan.traceIdLow.toString('hex'),
        '92b449d5929fda1b'
      );
      assert.deepStrictEqual(
        thriftSpan.traceIdHigh.toString('hex'),
        'd4cda95b652f4a15'
      );
      assert.deepStrictEqual(
        thriftSpan.spanId.toString('hex'),
        '6e0c63257de34c92'
      );
      assert.deepStrictEqual(thriftSpan.parentSpanId, ThriftUtils.emptyBuffer);
      assert.deepStrictEqual(thriftSpan.flags, 1);
      assert.deepStrictEqual(
        thriftSpan.startTime,
        Utils.encodeInt64(readableSpan.startTime * 1000)
      );
      assert.strictEqual(thriftSpan.tags.length, 4);
      const [tag1, tag2, tag3, tag4] = thriftSpan.tags;
      assert.strictEqual(tag1.key, 'testBool');
      assert.strictEqual(tag1.vType, 'BOOL');
      assert.strictEqual(tag1.vBool, true);
      assert.strictEqual(tag2.key, 'testString');
      assert.strictEqual(tag2.vType, 'STRING');
      assert.strictEqual(tag2.vStr, 'test');
      assert.strictEqual(tag3.key, 'testNum');
      assert.strictEqual(tag3.vType, 'DOUBLE');
      assert.strictEqual(tag3.vDouble, 3.142);
      assert.strictEqual(tag4.key, 'status.code');
      assert.strictEqual(tag4.vType, 'DOUBLE');
      assert.strictEqual(tag4.vDouble, 0);
      assert.strictEqual(thriftSpan.references.length, 0);

      assert.strictEqual(thriftSpan.logs.length, 1);
      const [log1] = thriftSpan.logs;
      assert.strictEqual(log1.fields.length, 2);
      const [field1, field2] = log1.fields;
      assert.strictEqual(field1.key, 'message.id');
      assert.strictEqual(field1.vType, 'STRING');
      assert.strictEqual(field1.vStr, 'something happened');
      assert.strictEqual(field2.key, 'error');
      assert.strictEqual(field2.vType, 'BOOL');
      assert.strictEqual(field2.vBool, true);
    });

    it('should convert an OpenTelemetry span to a Thrift when links, events and attributes are empty', () => {
      const readableSpan: ReadableSpan = {
        name: 'my-span1',
        kind: types.SpanKind.CLIENT,
        spanContext,
        startTime: 1566156729709,
        endTime: 1566156729709 + 2000,
        status: {
          code: types.CanonicalCode.DATA_LOSS,
          message: 'data loss',
        },
        attributes: {},
        links: [],
        events: [],
      };

      const thriftSpan = spanToThrift(readableSpan);
      const result = ThriftUtils._thrift.Span.rw.toBuffer(thriftSpan);
      assert.strictEqual(result.err, null);
      assert.deepStrictEqual(thriftSpan.operationName, 'my-span1');
      assert.deepStrictEqual(
        thriftSpan.traceIdLow.toString('hex'),
        '92b449d5929fda1b'
      );
      assert.deepStrictEqual(
        thriftSpan.traceIdHigh.toString('hex'),
        'd4cda95b652f4a15'
      );
      assert.deepStrictEqual(
        thriftSpan.spanId.toString('hex'),
        '6e0c63257de34c92'
      );
      assert.deepStrictEqual(thriftSpan.parentSpanId, ThriftUtils.emptyBuffer);
      assert.deepStrictEqual(thriftSpan.flags, 1);
      assert.strictEqual(thriftSpan.references.length, 0);
      assert.strictEqual(thriftSpan.tags.length, 3);
      const [tag1, tag2, tag3] = thriftSpan.tags;
      assert.strictEqual(tag1.key, 'status.code');
      assert.strictEqual(tag1.vType, 'DOUBLE');
      assert.strictEqual(tag1.vDouble, 15);
      assert.strictEqual(tag2.key, 'status.message');
      assert.strictEqual(tag2.vType, 'STRING');
      assert.strictEqual(tag2.vStr, 'data loss');
      assert.strictEqual(tag3.key, 'error');
      assert.strictEqual(tag3.vType, 'BOOL');
      assert.strictEqual(tag3.vBool, true);
      assert.strictEqual(thriftSpan.logs.length, 0);
    });

    it('should convert an OpenTelemetry span to a Thrift with ThriftReference', () => {
      const readableSpan: ReadableSpan = {
        name: 'my-span',
        kind: types.SpanKind.INTERNAL,
        spanContext,
        startTime: 1566156729709,
        endTime: 1566156729709 + 2000,
        status: {
          code: types.CanonicalCode.OK,
        },
        attributes: {},
        parentSpanId: '3e0c63257de34c92',
        links: [
          {
            spanContext: {
              traceId: 'a4cda95b652f4a1592b449d5929fda1b',
              spanId: '3e0c63257de34c92',
            },
          },
        ],
        events: [],
      };

      const thriftSpan = spanToThrift(readableSpan);
      const result = ThriftUtils._thrift.Span.rw.toBuffer(thriftSpan);
      assert.strictEqual(result.err, null);
      assert.deepStrictEqual(thriftSpan.operationName, 'my-span');
      assert.deepStrictEqual(
        thriftSpan.parentSpanId.toString('hex'),
        '3e0c63257de34c92'
      );
      assert.strictEqual(thriftSpan.references.length, 1);
      const [ref1] = thriftSpan.references;
      assert.strictEqual(ref1.traceIdLow.toString('hex'), '92b449d5929fda1b');
      assert.strictEqual(ref1.traceIdHigh.toString('hex'), 'a4cda95b652f4a15');
      assert.strictEqual(ref1.spanId.toString('hex'), '3e0c63257de34c92');
      assert.strictEqual(ref1.refType, ThriftReferenceType.CHILD_OF);
    });
  });
});
