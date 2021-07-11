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
  HistogramAggregatorType,
  Point,
  Histogram,
  AggregatorKind,
} from '../types';
import { HrTime } from '@opentelemetry/api';
import { hrTime } from '@opentelemetry/core';

/**
 * Basic aggregator which observes events and counts them in pre-defined buckets
 * and provides the total sum and count of all observations.
 */
export class HistogramAggregator implements HistogramAggregatorType {
  public kind: AggregatorKind.HISTOGRAM = AggregatorKind.HISTOGRAM;
  private _current: Histogram;
  private _lastUpdateTime: HrTime;
  private readonly _boundaries: number[];

  constructor(boundaries: number[]) {
    if (boundaries === undefined || boundaries.length === 0) {
      throw new Error('HistogramAggregator should be created with boundaries.');
    }
    // we need to an ordered set to be able to correctly compute count for each
    // boundary since we'll iterate on each in order.
    this._boundaries = boundaries.sort((a, b) => a - b);
    this._current = this._newEmptyCheckpoint();
    this._lastUpdateTime = hrTime();
  }

  update(value: number): void {
    this._lastUpdateTime = hrTime();
    this._current.count += 1;
    this._current.sum += value;

    for (let i = 0; i < this._boundaries.length; i++) {
      if (value < this._boundaries[i]) {
        this._current.buckets.counts[i] += 1;
        return;
      }
    }
    // value is above all observed boundaries
    this._current.buckets.counts[this._boundaries.length] += 1;
  }

  toPoint(): Point<Histogram> {
    return {
      value: this._current,
      timestamp: this._lastUpdateTime,
    };
  }

  private _newEmptyCheckpoint(): Histogram {
    return {
      buckets: {
        boundaries: this._boundaries,
        counts: this._boundaries.map(() => 0).concat([0]),
      },
      sum: 0,
      count: 0,
    };
  }
}
