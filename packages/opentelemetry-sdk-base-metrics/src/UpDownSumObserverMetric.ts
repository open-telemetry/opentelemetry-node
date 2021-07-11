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

import * as api from '@opentelemetry/api-metrics';
import { InstrumentationLibrary } from '@opentelemetry/core';
import { Resource } from '@opentelemetry/resources';
import { BaseObserverMetric } from './BaseObserverMetric';
import { Processor } from './export/Processor';
import { MetricKind } from './export/types';

/** This is a SDK implementation of UpDownSumObserver Metric. */
export class UpDownSumObserverMetric
  extends BaseObserverMetric
  implements api.UpDownSumObserver {
  constructor(
    name: string,
    options: api.MetricOptions,
    processor: Processor,
    resource: Resource,
    instrumentationLibrary: InstrumentationLibrary,
    callback?: (observerResult: api.ObserverResult) => unknown
  ) {
    super(
      name,
      options,
      processor,
      resource,
      MetricKind.UP_DOWN_SUM_OBSERVER,
      instrumentationLibrary,
      callback
    );
  }
}
