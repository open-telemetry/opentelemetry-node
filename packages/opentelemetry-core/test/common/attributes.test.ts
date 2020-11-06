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
import * as sinon from 'sinon';
import {
  isAttributeValue,
  sanitizeAttributes,
  truncateValueIfTooLong,
} from '../../src/common/attributes';

describe('attributes', () => {
  describe('#isAttributeValue', () => {
    it('should allow primitive values', () => {
      assert.ok(isAttributeValue(0));
      assert.ok(isAttributeValue(true));
      assert.ok(isAttributeValue('str'));
    });

    it('should allow nullish values', () => {
      assert.ok(isAttributeValue(null));
      assert.ok(isAttributeValue(undefined));
      // @ts-expect-error
      assert.ok(isAttributeValue());
    });

    it('should not allow objects', () => {
      assert.ok(!isAttributeValue({}));
    });

    it('should allow homogeneous arrays', () => {
      assert.ok(isAttributeValue([]));
      assert.ok(isAttributeValue([0, 1, 2]));
      assert.ok(isAttributeValue([true, false, true]));
      assert.ok(isAttributeValue(['str1', 'str2', 'str3']));
    });

    it('should allow homogeneous arrays with null values', () => {
      assert.ok(isAttributeValue([null]));
      assert.ok(isAttributeValue([0, null, 2]));
      assert.ok(isAttributeValue([true, null, true]));
      assert.ok(isAttributeValue(['str1', undefined, 'str3']));
    });

    it('should not allow heterogeneous arrays', () => {
      assert.ok(!isAttributeValue([0, false, 2]));
      assert.ok(!isAttributeValue([true, 'false', true]));
      assert.ok(!isAttributeValue(['str1', 2, 'str3']));
    });

    it('should not allow arrays of objects or nested arrays', () => {
      assert.ok(!isAttributeValue([{}]));
      assert.ok(!isAttributeValue([[]]));
    });
  });
  describe('#sanitize', () => {
    it('should remove invalid fields', () => {
      const attributes = sanitizeAttributes({
        str: 'string',
        num: 0,
        bool: false,
        object: {},
        arrStr: ['str1', null, 'str2'],
        arrNum: [0, null, 1],
        arrBool: [false, undefined, true],
        mixedArr: [0, false],
      });

      assert.deepStrictEqual(attributes, {
        str: 'string',
        num: 0,
        bool: false,
        arrStr: ['str1', null, 'str2'],
        arrNum: [0, null, 1],
        arrBool: [false, undefined, true],
      });
    });

    it('should copy the input', () => {
      const inp = {
        str: 'unmodified',
        arr: ['unmodified'],
      };

      const attributes = sanitizeAttributes(inp);

      inp.str = 'modified';
      inp.arr[0] = 'modified';

      assert.strictEqual(attributes.str, 'unmodified');
      assert.ok(Array.isArray(attributes.arr));
      assert.strictEqual(attributes.arr[0], 'unmodified');
    });
  });
  describe('#truncateValueIfTooLong', () => {
    it('should not truncate any given value if the limit is not set', () => {
      assert.strictEqual(truncateValueIfTooLong('a', null), 'a');
      assert.strictEqual(truncateValueIfTooLong(1, null), 1);
      assert.strictEqual(truncateValueIfTooLong(true, null), true);

      const arrayRef: string[] = [];
      assert.strictEqual(truncateValueIfTooLong(arrayRef, null), arrayRef);
    });

    it('passes numbers and bools through', () => {
      assert.strictEqual(truncateValueIfTooLong(true, 32), true);
      assert.strictEqual(truncateValueIfTooLong(false, 32), false);
      assert.strictEqual(truncateValueIfTooLong(1, 32), 1);
    });

    it('truncates strings if they are longer than the limit', () => {
      assert.strictEqual(
        truncateValueIfTooLong('a'.repeat(100), 100),
        'a'.repeat(100)
      );
      assert.strictEqual(
        truncateValueIfTooLong('a'.repeat(101), 100),
        'a'.repeat(100)
      );
    });

    it('serializes and truncates arrays if they are longer than the limit', () => {
      assert.strictEqual(
        truncateValueIfTooLong(['a'.repeat(100)], 32),
        '["' + 'a'.repeat(30)
      );
      assert.strictEqual(
        truncateValueIfTooLong(
          [...new Array(10).keys()].map(() => 1000),
          32
        ),
        '[' + '1000,'.repeat(6) + '1'
      );
      assert.strictEqual(
        truncateValueIfTooLong(
          [...new Array(10).keys()].map(() => true),
          32
        ),
        '[' + 'true,'.repeat(6) + 't'
      );
    });

    it('executes callback if a value was truncated', () => {
      const fakeCallback = sinon.spy();

      truncateValueIfTooLong('a'.repeat(32), 32, fakeCallback);
      assert.ok(!fakeCallback.called);

      truncateValueIfTooLong('a'.repeat(33), 32, fakeCallback);
      assert(fakeCallback.called);
    });
  });
});
