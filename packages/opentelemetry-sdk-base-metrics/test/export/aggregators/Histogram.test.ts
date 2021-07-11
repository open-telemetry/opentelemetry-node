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
import { HistogramAggregator } from '../../../src/export/aggregators';
import { Histogram } from '../../../src';
import { hrTime, hrTimeToMilliseconds } from '@opentelemetry/core';
import sinon = require('sinon');

describe('HistogramAggregator', () => {
  describe('constructor()', () => {
    it('should construct a histogramAggregator', () => {
      assert.doesNotThrow(() => {
        new HistogramAggregator([1, 2]);
      });
    });

    it('should sort boundaries', () => {
      const aggregator = new HistogramAggregator([
        200,
        500,
        300,
        700,
        1000,
        1500,
      ]);
      const point = aggregator.toPoint().value as Histogram;
      assert.deepEqual(point.buckets.boundaries, [
        200,
        300,
        500,
        700,
        1000,
        1500,
      ]);
    });

    it('should throw if no boundaries are defined', () => {
      // @ts-expect-error verify use without boundaries
      assert.throws(() => new HistogramAggregator());
      assert.throws(() => new HistogramAggregator([]));
    });
  });

  describe('.update()', () => {
    it('should update the second bucket', () => {
      const aggregator = new HistogramAggregator([100, 200]);
      aggregator.update(150);
      const point = aggregator.toPoint().value as Histogram;
      assert.equal(point.count, 1);
      assert.equal(point.sum, 150);
      assert.equal(point.buckets.counts[0], 0);
      assert.equal(point.buckets.counts[1], 1);
      assert.equal(point.buckets.counts[2], 0);
    });

    it('should update the second bucket', () => {
      const aggregator = new HistogramAggregator([100, 200]);
      aggregator.update(50);
      const point = aggregator.toPoint().value as Histogram;
      assert.equal(point.count, 1);
      assert.equal(point.sum, 50);
      assert.equal(point.buckets.counts[0], 1);
      assert.equal(point.buckets.counts[1], 0);
      assert.equal(point.buckets.counts[2], 0);
    });

    it('should update the third bucket since value is above all boundaries', () => {
      const aggregator = new HistogramAggregator([100, 200]);
      aggregator.update(250);
      const point = aggregator.toPoint().value as Histogram;
      assert.equal(point.count, 1);
      assert.equal(point.sum, 250);
      assert.equal(point.buckets.counts[0], 0);
      assert.equal(point.buckets.counts[1], 0);
      assert.equal(point.buckets.counts[2], 1);
    });

    it('should update the third bucket since boundaries are inclusive lower bounds', () => {
      const aggregator = new HistogramAggregator([100, 200]);
      aggregator.update(200);
      const point = aggregator.toPoint().value as Histogram;
      assert.equal(point.count, 1);
      assert.equal(point.sum, 200);
      assert.equal(point.buckets.counts[0], 0);
      assert.equal(point.buckets.counts[1], 0);
      assert.equal(point.buckets.counts[2], 1);
    });
  });

  describe('.timestamp', () => {
    let clock: sinon.SinonFakeTimers;
    before(() => {
      clock = sinon.useFakeTimers({ toFake: ['hrtime'] });
    });

    it('should update point timestamp', () => {
      const aggregator = new HistogramAggregator([100, 200]);
      const timestamp = hrTimeToMilliseconds(hrTime());
      const timeDiff = 10;
      clock.tick(timeDiff);
      aggregator.update(150);
      assert.equal(
        hrTimeToMilliseconds(aggregator.toPoint().timestamp) >=
          timestamp + timeDiff,
        true
      );
    });

    after(() => {
      clock.restore();
    });
  });

  describe('.count', () => {
    it('should return last checkpoint count', () => {
      const aggregator = new HistogramAggregator([100]);
      let point = aggregator.toPoint().value as Histogram;
      assert.equal(point.count, point.count);
      aggregator.update(10);
      point = aggregator.toPoint().value as Histogram;
      assert.equal(point.count, 1);
      assert.equal(point.count, point.count);
    });
  });

  describe('.sum', () => {
    it('should return last checkpoint sum', () => {
      const aggregator = new HistogramAggregator([100]);
      let point = aggregator.toPoint().value as Histogram;
      assert.equal(point.sum, point.sum);
      aggregator.update(10);
      point = aggregator.toPoint().value as Histogram;
      assert.equal(point.sum, 10);
    });
  });

  describe('.reset()', () => {
    it('should create a empty checkoint by default', () => {
      const aggregator = new HistogramAggregator([100]);
      const point = aggregator.toPoint().value as Histogram;
      assert.deepEqual(point.buckets.boundaries, [100]);
      assert(point.buckets.counts.every(count => count === 0));
      // should contains one bucket for each boundary + one for values outside of the largest boundary
      assert.equal(point.buckets.counts.length, 2);
      assert.deepEqual(point.buckets.boundaries, [100]);
      assert.equal(point.count, 0);
      assert.equal(point.sum, 0);
    });

    it('should update checkpoint', () => {
      const aggregator = new HistogramAggregator([100]);
      aggregator.update(10);
      const point = aggregator.toPoint().value as Histogram;
      assert.equal(point.count, 1);
      assert.equal(point.sum, 10);
      assert.deepEqual(point.buckets.boundaries, [100]);
      assert.equal(point.buckets.counts.length, 2);
      assert.deepEqual(point.buckets.counts, [1, 0]);
    });
  });

  describe('.toPoint()', () => {
    it('should return default checkpoint', () => {
      const aggregator = new HistogramAggregator([100]);
      const point = aggregator.toPoint().value as Histogram;
      assert.deepEqual(aggregator.toPoint().value, point);
      assert(aggregator.toPoint().timestamp.every(nbr => nbr > 0));
    });

    it('should return last checkpoint if updated', () => {
      const aggregator = new HistogramAggregator([100]);
      aggregator.update(100);
      assert(
        aggregator
          .toPoint()
          .timestamp.every(nbr => typeof nbr === 'number' && nbr !== 0)
      );
    });
  });
});
