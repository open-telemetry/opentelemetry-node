/*!
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

import {
  MetricObservable,
  ObserverResult as TypeObserverResult,
  BoundObserverResult as TypeBoundObserverResult,
  Labels,
} from '@opentelemetry/api';

/**
 * Implementation of {@link TypeObserverResult}
 */
export class ObserverResult implements TypeObserverResult {
  callbackObservers: Map<Labels, Function> = new Map<Labels, Function>();
  observers: Map<Labels, MetricObservable> = new Map<
    Labels,
    MetricObservable
  >();

  observe(callback: Function | MetricObservable, labels: Labels): void {
    if (typeof callback === 'function') {
      this.callbackObservers.set(labels, callback);
    } else {
      this.observers.set(labels, callback);
    }
  }
}

export class BoundObserverResult implements TypeBoundObserverResult {
  constructor(
    private _observerResult: ObserverResult,
    private _labels: Labels
  ) {}

  observe(callback: Function | MetricObservable): void {
    if (typeof callback === 'function') {
      this._observerResult.callbackObservers.set(this._labels, callback);
    } else {
      this._observerResult.observers.set(this._labels, callback);
    }
  }
}
