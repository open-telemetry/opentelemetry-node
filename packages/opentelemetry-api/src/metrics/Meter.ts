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

import { BatchObserverResult } from './BatchObserverResult';
import {
  MetricOptions,
  Counter,
  ValueRecorder,
  ValueObserver,
  BatchObserver,
  BatchMetricOptions,
} from './Metric';
import { ObserverResult } from './ObserverResult';

/**
 * An interface to allow the recording metrics.
 *
 * {@link Metric}s are used for recording pre-defined aggregation (`Counter`),
 * or raw values (`ValueRecorder`) in which the aggregation and labels
 * for the exported metric are deferred.
 */
export interface Meter {
  /**
   * Creates and returns a new `ValueRecorder`.
   * @param name the name of the metric.
   * @param [options] the metric options.
   */
  createValueRecorder(name: string, options?: MetricOptions): ValueRecorder;

  /**
   * Creates a new `Counter` metric. Generally, this kind of metric when the
   * value is a quantity, the sum is of primary interest, and the event count
   * and value distribution are not of primary interest.
   * @param name the name of the metric.
   * @param [options] the metric options.
   */
  createCounter(name: string, options?: MetricOptions): Counter;

  /**
   * Creates a new `ValueObserver` metric.
   * @param name the name of the metric.
   * @param [options] the metric options.
   * @param [callback] the observer callback
   */
  createValueObserver(
    name: string,
    options?: MetricOptions,
    callback?: (observerResult: ObserverResult) => void
  ): ValueObserver;

  /**
   * Creates a new `BatchObserver` metric, can be used to update many metrics
   * at the same time and when operations needs to be async
   * @param name the name of the metric.
   * @param callback the batch observer callback
   * @param [options] the metric batch options.
   */
  createBatchObserver(
    name: string,
    callback: (batchObserverResult: BatchObserverResult) => void,
    options?: BatchMetricOptions
  ): BatchObserver;
}
