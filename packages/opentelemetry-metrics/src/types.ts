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

import { LogLevel, ExportResult } from '@opentelemetry/core';
import * as api from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { Batcher } from './export/Batcher';
import { MetricRecord } from './export/types';

/** MeterConfig provides an interface for configuring a Meter. */
export interface MeterConfig {
  /** User provided logger. */
  logger?: api.Logger;

  /** level of logger. */
  logLevel?: LogLevel;

  /** Resource associated with metric telemetry */
  resource?: Resource;

  /** Metric batcher. */
  batcher?: Batcher;
}

/** Default Meter configuration. */
export const DEFAULT_CONFIG = {
  logLevel: LogLevel.INFO,
};

/** The default metric creation options value. */
export const DEFAULT_METRIC_OPTIONS = {
  disabled: false,
  absolute: false,
  description: '',
  unit: '1',
  valueType: api.ValueType.DOUBLE,
};

/** Represents an metrics collection interface. */
export interface MetricsCollector {
  /** Collect metrics registered with the metrics collector. */
  collect(): Promise<MetricRecord[]>;
}
