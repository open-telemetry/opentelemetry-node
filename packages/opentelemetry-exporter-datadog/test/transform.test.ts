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

import * as assert from 'assert';
import { Resource } from '@opentelemetry/resources';
import * as api from '@opentelemetry/api';
import { ReadableSpan } from '@opentelemetry/tracing';
import { hrTimeToMilliseconds, TraceState } from '@opentelemetry/core';
import { id } from '../src/types'
import { translateToDatadog } from '../src/transform';

describe('transform', () => {
  const spanContextUnsampled = {
    traceId: 'd4cda95b652f4a1592b449d5929fda1b',
    spanId: '6e0c63257de34c92',
    traceFlags: api.TraceFlags.NONE,
  };

  const spanContextSampled = {
    traceId: 'd4cda95b652f4a1592b449d5929fda1b',
    spanId: '6e0c63257de34c92',
    traceFlags: api.TraceFlags.SAMPLED,
  };

  const spanContextOrigin = {
    traceId: 'd4cda95b652f4a1592b449d5929fda1b',
    spanId: '6e0c63257de34c92',
    traceFlags: api.TraceFlags.SAMPLED,
    traceState: new TraceState('dd_origin=synthetics-example')
  };

  const service_name = 'my-service';

  const generateOtelSpans = function (options: any): ReadableSpan[] {
    const otelSpans = []
    const span: ReadableSpan = {
        name: 'my-span',
        kind: api.SpanKind.INTERNAL,
        startTime: [1566156729, 709],
        endTime: [1566156731, 709],
        ended: true,
        status: {
          code: api.CanonicalCode.OK,
        },
        attributes: {
          testBool: true,
          testString: 'test',
          testNum: 3.142,
        },
        links: [
          {
            context: {
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
            time: [1566156729, 809],
          },
        ],
        duration: [32, 800000000],
        resource: new Resource({
          service: 'ui',
          version: 1,
          cost: 112.12,
        }),
        // instrumentationLibrary: {
        //   name: 'default',
        //   version: '0.0.1',
        // },
      };
      const updatedSpan = Object.assign(span, options)
      otelSpans.push(updatedSpan)
      return otelSpans
    }

  describe('translateToDatadog', () => {
    it('should convert an OpenTelemetry span to a DatadogSpan', () => {
      const spans = generateOtelSpans({spanContext: spanContextUnsampled})
      const datadogSpans = translateToDatadog(spans, service_name);
      const datadogSpan = datadogSpans[0]
      // const result = ThriftUtils._thrift.Span.rw.toBuffer(thriftSpan);
      // assert.strictEqual(result.err, null);
      // console.log('datadog Span iz: ', datadogSpan)
      assert.deepStrictEqual(datadogSpan.name, 'internal');
      assert.deepStrictEqual(datadogSpan.resource, spans[0].name);
      assert.deepStrictEqual(datadogSpan.service, service_name);

      assert.deepStrictEqual(
        datadogSpan.trace_id,
        id(spanContextUnsampled.traceId)
      );

      assert.deepStrictEqual(
        datadogSpan.span_id.toString('hex'),
        spanContextUnsampled.spanId
      );

      assert.deepStrictEqual(datadogSpan.parent_id.toString('hex'), '0000000000000000');
      assert.deepStrictEqual(datadogSpan.error, 0);
      assert.deepStrictEqual(
        datadogSpan.start,
        Math.round( hrTimeToMilliseconds(spans[0].startTime) * 1e6 )
      );
      assert.strictEqual(Object.keys(datadogSpan.meta).length, 3);
      assert.strictEqual(datadogSpan.metrics['_sample_rate'], spanContextUnsampled.traceFlags);
      // const [
      //   tag1,
      //   tag2,
      //   tag3,
      //   tag4,
      //   tag5,
      //   tag6,
      //   tag7,
      //   tag8,
      //   tag9,
      // ] = thriftSpan.tags;
      // assert.strictEqual(tag1.key, 'testBool');
      // assert.strictEqual(tag1.vType, 'BOOL');
      // assert.strictEqual(tag1.vBool, true);
      // assert.strictEqual(tag2.key, 'testString');
      // assert.strictEqual(tag2.vType, 'STRING');
      // assert.strictEqual(tag2.vStr, 'test');
      // assert.strictEqual(tag3.key, 'testNum');
      // assert.strictEqual(tag3.vType, 'DOUBLE');
      // assert.strictEqual(tag3.vDouble, 3.142);
      // assert.strictEqual(tag4.key, 'status.code');
      // assert.strictEqual(tag4.vType, 'DOUBLE');
      // assert.strictEqual(tag4.vDouble, 0);
      // assert.strictEqual(tag5.key, 'status.name');
      // assert.strictEqual(tag5.vType, 'STRING');
      // assert.strictEqual(tag5.vStr, 'OK');
      // assert.strictEqual(tag6.key, 'span.kind');
      // assert.strictEqual(tag6.vType, 'STRING');
      // assert.strictEqual(tag6.vStr, 'INTERNAL');
      // assert.strictEqual(tag7.key, 'service');
      // assert.strictEqual(tag7.vType, 'STRING');
      // assert.strictEqual(tag7.vStr, 'ui');
      // assert.strictEqual(tag8.key, 'version');
      // assert.strictEqual(tag8.vType, 'DOUBLE');
      // assert.strictEqual(tag8.vDouble, 1);
      // assert.strictEqual(tag9.key, 'cost');
      // assert.strictEqual(tag9.vType, 'DOUBLE');
      // assert.strictEqual(tag9.vDouble, 112.12);
      // assert.strictEqual(thriftSpan.references.length, 0);

      // assert.strictEqual(thriftSpan.logs.length, 1);
      // const [log1] = thriftSpan.logs;
      // assert.strictEqual(log1.fields.length, 2);
      // const [field1, field2] = log1.fields;
      // assert.strictEqual(field1.key, 'message.id');
      // assert.strictEqual(field1.vType, 'STRING');
      // assert.strictEqual(field1.vStr, 'something happened');
      // assert.strictEqual(field2.key, 'error');
      // assert.strictEqual(field2.vType, 'BOOL');
      // assert.strictEqual(field2.vBool, true);
    });

    it('should sample spans with sampled traceFlag', () => {
      const spans = generateOtelSpans({spanContext: spanContextSampled})
      const datadogSpans = translateToDatadog(spans, service_name);
      const datadogSpan = datadogSpans[0]

      assert.strictEqual(datadogSpan.metrics['_sample_rate'], spanContextSampled.traceFlags);
    })

    it('should set origin tag for spans with origin traceState', () => {
      const spans = generateOtelSpans({spanContext: spanContextOrigin})
      const datadogSpans = translateToDatadog(spans, service_name);
      const datadogSpan = datadogSpans[0]

      assert.strictEqual(datadogSpan.meta['_dd_origin'], 'synthetics-example');
    }) 

    // it('should convert an OpenTelemetry span to a Thrift when links, events and attributes are empty', () => {
    //   const readableSpan: ReadableSpan = {
    //     name: 'my-span1',
    //     kind: api.SpanKind.CLIENT,
    //     spanContext,
    //     startTime: [1566156729, 709],
    //     endTime: [1566156731, 709],
    //     ended: true,
    //     status: {
    //       code: api.CanonicalCode.DATA_LOSS,
    //       message: 'data loss',
    //     },
    //     attributes: {},
    //     links: [],
    //     events: [],
    //     duration: [32, 800000000],
    //     resource: Resource.empty(),
    //     instrumentationLibrary: {
    //       name: 'default',
    //       version: '0.0.1',
    //     },
    //   };

    //   const thriftSpan = spanToThrift(readableSpan);
    //   const result = ThriftUtils._thrift.Span.rw.toBuffer(thriftSpan);
    //   assert.strictEqual(result.err, null);
    //   assert.deepStrictEqual(thriftSpan.operationName, 'my-span1');
    //   assert.deepStrictEqual(
    //     thriftSpan.traceIdLow.toString('hex'),
    //     '92b449d5929fda1b'
    //   );
    //   assert.deepStrictEqual(
    //     thriftSpan.traceIdHigh.toString('hex'),
    //     'd4cda95b652f4a15'
    //   );
    //   assert.deepStrictEqual(
    //     thriftSpan.spanId.toString('hex'),
    //     '6e0c63257de34c92'
    //   );
    //   assert.deepStrictEqual(thriftSpan.parentSpanId, ThriftUtils.emptyBuffer);
    //   assert.deepStrictEqual(thriftSpan.flags, 1);
    //   assert.strictEqual(thriftSpan.references.length, 0);
    //   assert.strictEqual(thriftSpan.tags.length, 5);
    //   const [tag1, tag2, tag3, tag4, tag5] = thriftSpan.tags;
    //   assert.strictEqual(tag1.key, 'status.code');
    //   assert.strictEqual(tag1.vType, 'DOUBLE');
    //   assert.strictEqual(tag1.vDouble, 15);
    //   assert.strictEqual(tag2.key, 'status.name');
    //   assert.strictEqual(tag2.vType, 'STRING');
    //   assert.strictEqual(tag2.vStr, 'DATA_LOSS');
    //   assert.strictEqual(tag3.key, 'status.message');
    //   assert.strictEqual(tag3.vType, 'STRING');
    //   assert.strictEqual(tag3.vStr, 'data loss');
    //   assert.strictEqual(tag4.key, 'error');
    //   assert.strictEqual(tag4.vType, 'BOOL');
    //   assert.strictEqual(tag4.vBool, true);
    //   assert.strictEqual(tag5.key, 'span.kind');
    //   assert.strictEqual(tag5.vType, 'STRING');
    //   assert.strictEqual(tag5.vStr, 'CLIENT');
    //   assert.strictEqual(thriftSpan.logs.length, 0);
    // });

    // it('should convert an OpenTelemetry span to a Thrift with ThriftReference', () => {
    //   const readableSpan: ReadableSpan = {
    //     name: 'my-span',
    //     kind: api.SpanKind.INTERNAL,
    //     spanContext,
    //     startTime: [1566156729, 709],
    //     endTime: [1566156731, 709],
    //     ended: true,
    //     status: {
    //       code: api.CanonicalCode.OK,
    //     },
    //     attributes: {},
    //     parentSpanId: '3e0c63257de34c92',
    //     links: [
    //       {
    //         context: {
    //           traceId: 'a4cda95b652f4a1592b449d5929fda1b',
    //           spanId: '3e0c63257de34c92',
    //         },
    //       },
    //     ],
    //     events: [],
    //     duration: [32, 800000000],
    //     resource: Resource.empty(),
    //     instrumentationLibrary: {
    //       name: 'default',
    //       version: '0.0.1',
    //     },
    //   };

    //   const thriftSpan = spanToThrift(readableSpan);
    //   const result = ThriftUtils._thrift.Span.rw.toBuffer(thriftSpan);
    //   assert.strictEqual(result.err, null);
    //   assert.deepStrictEqual(thriftSpan.operationName, 'my-span');
    //   assert.deepStrictEqual(
    //     thriftSpan.parentSpanId.toString('hex'),
    //     '3e0c63257de34c92'
    //   );
    //   assert.strictEqual(thriftSpan.references.length, 1);
    //   const [ref1] = thriftSpan.references;
    //   assert.strictEqual(ref1.traceIdLow.toString('hex'), '92b449d5929fda1b');
    //   assert.strictEqual(ref1.traceIdHigh.toString('hex'), 'a4cda95b652f4a15');
    //   assert.strictEqual(ref1.spanId.toString('hex'), '3e0c63257de34c92');
    //   assert.strictEqual(ref1.refType, ThriftReferenceType.CHILD_OF);
    // });

    // it('should left pad trace ids', () => {
    //   const readableSpan: ReadableSpan = {
    //     name: 'my-span1',
    //     kind: api.SpanKind.CLIENT,
    //     spanContext: {
    //       traceId: '92b449d5929fda1b',
    //       spanId: '6e0c63257de34c92',
    //       traceFlags: TraceFlags.NONE,
    //     },
    //     startTime: [1566156729, 709],
    //     endTime: [1566156731, 709],
    //     ended: true,
    //     status: {
    //       code: api.CanonicalCode.DATA_LOSS,
    //       message: 'data loss',
    //     },
    //     attributes: {},
    //     links: [],
    //     events: [],
    //     duration: [32, 800000000],
    //     resource: Resource.empty(),
    //     instrumentationLibrary: {
    //       name: 'default',
    //       version: '0.0.1',
    //     },
    //   };

    //   const thriftSpan = spanToThrift(readableSpan);

    //   assert.strictEqual(
    //     thriftSpan.traceIdLow.toString('hex'),
    //     '92b449d5929fda1b'
    //   );
    //   assert.strictEqual(
    //     thriftSpan.traceIdHigh.toString('hex'),
    //     '0000000000000000'
    //   );
    // });
  });
});
