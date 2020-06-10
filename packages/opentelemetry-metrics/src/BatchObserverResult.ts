/*!
 * Copyright 2020, OpenTelemetry Authors
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

import * as api from '@opentelemetry/api';
import { Observation } from './Observation';

/**
 * Implementation of api BatchObserverResult
 */
export class BatchObserverResult implements api.BatchObserverResult {
  private _callback: (() => void) | undefined;
  private _immediate: NodeJS.Immediate | undefined;
  /**
   * Cancels the further updates.
   * This is used to prevent updating the value of result that took too
   * long to update. For example to avoid update after timeout.
   * See {@link BatchObserverMetric.getMetricRecord}
   */
  cancelled = false;

  /**
   * used to save a callback that will be called after the observations are
   *     updated
   * @param callback
   */
  onObserveCalled(callback: () => void) {
    if (this.cancelled) {
      return;
    }
    this._callback = callback;
  }

  observe(labels: api.Labels, observations: Observation[]): void {
    if (this.cancelled) {
      return;
    }
    observations.forEach(observation => {
      observation.valueObserver.bind(labels).update(observation.value);
    });
    if (!this._immediate) {
      this._immediate = setImmediate(() => {
        if (typeof this._callback === 'function') {
          this._callback();
        }
      });
    }
  }
}
