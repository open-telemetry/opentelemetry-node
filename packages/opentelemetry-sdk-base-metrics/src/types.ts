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
import { Resource } from '@opentelemetry/resources';
import { Processor } from './export/Processor';
import { MetricExporter } from './export/types';

/** MeterConfig provides an interface for configuring a Meter. */
export interface MeterConfig {
  /** Metric exporter. */
  exporter?: MetricExporter;

  /** Metric collect interval */
  interval?: number;

  /** Resource associated with metric telemetry */
  resource?: Resource;

  /** Metric Processor. */
  processor?: Processor;
}

/** Default Meter configuration. */
export const DEFAULT_CONFIG = {};

/** The default metric creation options value. */
export const DEFAULT_METRIC_OPTIONS = {
  disabled: false,
  description: '',
  unit: '1',
  valueType: api.ValueType.DOUBLE,
};
