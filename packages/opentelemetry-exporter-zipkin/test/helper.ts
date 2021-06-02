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

import { TraceFlags, SpanStatusCode } from '@opentelemetry/api';
import { ReadableSpan } from '@opentelemetry/tracing';
import { Resource } from '@opentelemetry/resources';
import * as assert from 'assert';
import { Span } from '../src/types';

export const mockedReadableSpan: ReadableSpan = {
  name: 'documentFetch',
  kind: 0,
  spanContext: () => {
    return {
      traceId: '1f1008dc8e270e85c40a0d7c3939b278',
      spanId: '5e107261f64fa53e',
      traceFlags: TraceFlags.SAMPLED,
    };
  },
  parentSpanId: '78a8915098864388',
  startTime: [1574120165, 429803070],
  endTime: [1574120165, 438688070],
  ended: true,
  status: { code: SpanStatusCode.OK },
  attributes: { component: 'foo' },
  links: [],
  events: [],
  duration: [0, 8885000],
  resource: new Resource({
    service: 'ui',
    version: 1,
    cost: 112.12,
  }),
  instrumentationLibrary: { name: 'default', version: '0.0.1' },
};

export function ensureHeadersContain(
  actual: { [key: string]: string },
  expected: { [key: string]: string }
) {
  Object.entries(expected).forEach(([k, v]) => {
    assert.strictEqual(
      v,
      actual[k],
      `Expected ${ actual } to contain ${ k }: ${ v }`
    );
  });
}

export function ensureSpanIsCorrect(span: Span) {
  assert.deepStrictEqual(span, {
    traceId: '1f1008dc8e270e85c40a0d7c3939b278',
    parentId: '78a8915098864388',
    name: 'documentFetch',
    id: '5e107261f64fa53e',
    timestamp: 1574120165429803,
    duration: 8885,
    localEndpoint: { serviceName: 'OpenTelemetry Service' },
    tags: {
      component: 'foo',
      'ot.status_code': 'OK',
      service: 'ui',
      version: '1',
      cost: '112.12',
    },
  });
}
