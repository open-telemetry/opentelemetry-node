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

import { Point, Sum, AggregatorKind, SumAggregatorType } from '../types';
import { HrTime } from '@opentelemetry/api';
import { hrTime } from '@opentelemetry/core';

/** Basic aggregator which calculates a Sum from individual measurements. */
export class SumAggregator implements SumAggregatorType {
  public kind: AggregatorKind.SUM = AggregatorKind.SUM;
  private _current: number = 0;
  private _lastUpdateTime: HrTime = [0, 0];

  update(value: number): void {
    this._current += value;
    this._lastUpdateTime = hrTime();
  }

  toPoint(): Point<Sum> {
    return {
      value: this._current,
      timestamp: this._lastUpdateTime,
    };
  }
}
