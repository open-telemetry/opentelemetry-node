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
import { ROOT_CONTEXT } from '@opentelemetry/api';
import * as assert from 'assert';
import { HttpBaggagePropagator } from '../../src/baggage/propagation/HttpBaggagePropagator';
import { BAGGAGE_HEADER } from '../../src/baggage/constants';

describe('HttpBaggagePropagator', () => {
  const httpBaggagePropagator = new HttpBaggagePropagator();

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

      httpBaggagePropagator.inject(
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

      httpBaggagePropagator.inject(
        setBaggage(ROOT_CONTEXT, baggage),
        carrier,
        defaultTextMapSetter
      );
      assert.deepStrictEqual(
        carrier[BAGGAGE_HEADER],
        'key1=d4cda95b,key3=c88815a7'
      );
    });

    it('should skip all entries whose length exceeds the W3C standard limit of 4096 bytes', () => {
      const longKey = Array(96).fill('k').join('');
      const shortKey = Array(95).fill('k').join('');
      const value = Array(4000).fill('v').join('');

      let baggage = createBaggage({
        aa: { value: 'shortvalue' },
        [shortKey]: { value: value },
      });

      httpBaggagePropagator.inject(
        setBaggage(ROOT_CONTEXT, baggage),
        carrier,
        defaultTextMapSetter
      );

      let header = carrier[BAGGAGE_HEADER];
      assert.ok(typeof header === 'string');
      assert.deepStrictEqual(header, `aa=shortvalue,${shortKey}=${value}`);

      baggage = createBaggage({
        aa: { value: 'shortvalue' },
        [longKey]: { value: value },
      });

      carrier = {};
      httpBaggagePropagator.inject(
        setBaggage(ROOT_CONTEXT, baggage),
        carrier,
        defaultTextMapSetter
      );

      header = carrier[BAGGAGE_HEADER];
      assert.ok(typeof header === 'string');
      assert.deepStrictEqual(header, 'aa=shortvalue');
    });

    it('should not exceed the W3C standard header length limit of 8192 bytes', () => {
      const longKey0 = Array(48).fill('0').join('');
      const longKey1 = Array(49).fill('1').join('');
      const longValue = Array(4000).fill('v').join('');

      let baggage = createBaggage({
        [longKey0]: { value: longValue },
        [longKey1]: { value: longValue },
        aa: { value: Array(88).fill('v').join('') },
      });

      httpBaggagePropagator.inject(
        setBaggage(ROOT_CONTEXT, baggage),
        carrier,
        defaultTextMapSetter
      );

      let header = carrier[BAGGAGE_HEADER];
      assert.ok(typeof header === 'string');
      assert.deepStrictEqual(header.length, 8192);
      assert.deepStrictEqual(header.split(',').length, 3);

      baggage = createBaggage({
        [longKey0]: { value: longValue },
        [longKey1]: { value: longValue },
        aa: { value: Array(89).fill('v').join('') },
      });

      carrier = {};
      httpBaggagePropagator.inject(
        setBaggage(ROOT_CONTEXT, baggage),
        carrier,
        defaultTextMapSetter
      );

      header = carrier[BAGGAGE_HEADER];
      assert.ok(typeof header === 'string');
      assert.deepStrictEqual(header.length, 8100);
      assert.deepStrictEqual(header.split(',').length, 2);
    });

    it('should not exceed the W3C standard header entry limit of 180 entries', () => {
      const entries: Record<string, BaggageEntry> = {};

      Array(200)
        .fill(0)
        .forEach((_, i) => {
          entries[`${i}`] = { value: 'v' };
        });

      const baggage = createBaggage(entries);

      httpBaggagePropagator.inject(
        setBaggage(ROOT_CONTEXT, baggage),
        carrier,
        defaultTextMapSetter
      );

      const header = carrier[BAGGAGE_HEADER];
      assert.ok(typeof header === 'string');
      assert.strictEqual(header.split(',').length, 180);
    });
  });

  describe('.extract()', () => {
    it('should extract context of a sampled span from carrier', () => {
      carrier[BAGGAGE_HEADER] =
        'key1=d4cda95b,key3=c88815a7, keyn   = valn, keym =valm';
      const extractedBaggage = getBaggage(
        httpBaggagePropagator.extract(
          ROOT_CONTEXT,
          carrier,
          defaultTextMapGetter
        )
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
      const propagator = new HttpBaggagePropagator();
      assert.deepStrictEqual(propagator.fields(), [BAGGAGE_HEADER]);
    });
  });

  it('returns undefined if header is missing', () => {
    assert.deepStrictEqual(
      getBaggage(
        httpBaggagePropagator.extract(
          ROOT_CONTEXT,
          carrier,
          defaultTextMapGetter
        )
      ),
      undefined
    );
  });

  it('returns keys with their properties', () => {
    carrier[BAGGAGE_HEADER] = 'key1=d4cda95b,key3=c88815a7;prop1=value1';
    const bag = getBaggage(
      httpBaggagePropagator.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
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
        httpBaggagePropagator.extract(
          ROOT_CONTEXT,
          carrier,
          defaultTextMapGetter
        )
      );
      assert.deepStrictEqual(
        extractedSpanContext,
        testCases[testCase].baggage,
        testCase
      );
    });
  });
});
