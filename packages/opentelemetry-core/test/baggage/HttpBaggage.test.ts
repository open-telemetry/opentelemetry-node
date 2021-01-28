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
  Baggage,
  BaggageEntry,
  createBaggage,
  defaultTextMapGetter,
  defaultTextMapSetter,
  getBaggage,
  setBaggage,
} from '@opentelemetry/api';
import { ROOT_CONTEXT } from '@opentelemetry/context-base';
import * as assert from 'assert';
import {
  BAGGAGE_HEADER,
  HttpBaggage,
} from '../../src/baggage/propagation/HttpBaggage';

describe('HttpBaggage', () => {
  const httpTraceContext = new HttpBaggage();

  let carrier: { [key: string]: unknown };

  beforeEach(() => {
    carrier = {};
  });

  describe('.inject()', () => {
    it('should set baggage header', () => {
      const baggage = createBaggage({
        key1: { value: 'd4cda95b652f4a1592b449d5929fda1b' },
        key3: { value: 'c88815a7-0fa9-4d95-a1f1-cdccce3c5c2a' },
        'with/slash': { value: 'with spaces' },
      });

      httpTraceContext.inject(
        setBaggage(ROOT_CONTEXT, baggage),
        carrier,
        defaultTextMapSetter
      );
      assert.deepStrictEqual(
        carrier[BAGGAGE_HEADER],
        'key1=d4cda95b652f4a1592b449d5929fda1b,key3=c88815a7-0fa9-4d95-a1f1-cdccce3c5c2a,with%2Fslash=with%20spaces'
      );
    });

    it('should skip long key-value pairs', () => {
      const baggage = createBaggage({
        key1: { value: 'd4cda95b' },
        key3: { value: 'c88815a7' },
      });

      httpTraceContext.inject(
        setBaggage(ROOT_CONTEXT, baggage),
        carrier,
        defaultTextMapSetter
      );
      assert.deepStrictEqual(
        carrier[BAGGAGE_HEADER],
        'key1=d4cda95b,key3=c88815a7'
      );
    });

    it('should skip all keys that surpassed the max limit of the header', () => {
      const zeroPad = (num: number, places: number) =>
        String(num).padStart(places, '0');

      const bag: Record<string, BaggageEntry> = {};

      // key=value with same size , 1024 => 8 keys
      for (let i = 0; i < 9; ++i) {
        const index = zeroPad(i, 510);
        bag[`k${index}`] = { value: `${index}` };
      }

      const baggage = createBaggage(bag);

      // Build expected
      let expected = '';
      for (let i = 0; i < 8; ++i) {
        const index = zeroPad(i, 510);
        expected += `k${index}=${index},`;
      }
      expected = expected.slice(0, -1);

      httpTraceContext.inject(
        setBaggage(ROOT_CONTEXT, baggage),
        carrier,
        defaultTextMapSetter
      );
      assert.deepStrictEqual(carrier[BAGGAGE_HEADER], expected);
    });
  });

  describe('.extract()', () => {
    it('should extract context of a sampled span from carrier', () => {
      carrier[BAGGAGE_HEADER] =
        'key1=d4cda95b,key3=c88815a7, keyn   = valn, keym =valm';
      const extractedBaggage = getBaggage(
        httpTraceContext.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
      );

      const expected = createBaggage({
        key1: { value: 'd4cda95b' },
        key3: { value: 'c88815a7' },
        keyn: { value: 'valn' },
        keym: { value: 'valm' },
      });
      assert.deepStrictEqual(extractedBaggage, expected);
    });
  });

  describe('fields()', () => {
    it('returns the fields used by the baggage spec', () => {
      const propagator = new HttpBaggage();
      assert.deepStrictEqual(propagator.fields(), [BAGGAGE_HEADER]);
    });
  });

  it('returns undefined if header is missing', () => {
    assert.deepStrictEqual(
      getBaggage(
        httpTraceContext.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
      ),
      undefined
    );
  });

  it('returns keys with their properties', () => {
    carrier[BAGGAGE_HEADER] = 'key1=d4cda95b,key3=c88815a7;prop1=value1';
    const bag = getBaggage(
      httpTraceContext.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
    );

    assert.ok(bag);
    const entries = bag.getAllEntries();

    assert.strictEqual(entries.length, 2);
    assert.deepStrictEqual(bag.getEntry('key1')!.value, 'd4cda95b');
    assert.deepStrictEqual(bag.getEntry('key3')!.value, 'c88815a7');
    assert.deepStrictEqual(
      bag.getEntry('key3')!.metadata?.toString(),
      'prop1=value1'
    );
  });

  it('should gracefully handle an invalid header', () => {
    const testCases: Record<
      string,
      {
        header: string;
        baggage: Baggage | undefined;
      }
    > = {
      invalidNoKeyValuePair: {
        header: '289371298nekjh2939299283jbk2b',
        baggage: undefined,
      },
      invalidDoubleEqual: {
        header: 'key1==value;key2=value2',
        baggage: undefined,
      },
      invalidWrongKeyValueFormat: {
        header: 'key1:value;key2=value2',
        baggage: undefined,
      },
      invalidDoubleSemicolon: {
        header: 'key1:value;;key2=value2',
        baggage: undefined,
      },
      mixInvalidAndValidKeys: {
        header: 'key1==value,key2=value2',
        baggage: createBaggage({
          key2: {
            value: 'value2',
          },
        }),
      },
    };
    Object.getOwnPropertyNames(testCases).forEach(testCase => {
      carrier[BAGGAGE_HEADER] = testCases[testCase].header;

      const extractedSpanContext = getBaggage(
        httpTraceContext.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
      );
      assert.deepStrictEqual(
        extractedSpanContext,
        testCases[testCase].baggage,
        testCase
      );
    });
  });
});
