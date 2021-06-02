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

import { TracerProvider } from '@opentelemetry/api';
import { MeterProvider } from '@opentelemetry/api-metrics';

/** Interface Instrumentation to apply patch. */
export interface Instrumentation {
  /** Instrumentation Name  */
  instrumentationName: string;

  /** Instrumentation Version  */
  instrumentationVersion: string;

  /**
   * Instrumentation Description - please describe all useful information
   * as Instrumentation might patch different version of different modules,
   * or support different browsers etc.
   */
  instrumentationDescription?: string;

  /** Method to disable the instrumentation  */
  disable(): void;

  /** Method to enable the instrumentation  */
  enable(): void;

  /** Method to set tracer provider  */
  setTracerProvider(tracerProvider: TracerProvider): void;

  /** Method to set meter provider  */
  setMeterProvider(meterProvider: MeterProvider): void;

  /** Method to set instrumentation config  */
  setConfig(config: InstrumentationConfig): void;

  /** Method to get instrumentation config  */
  getConfig(): InstrumentationConfig;

  /**
   * Contains all supported versions.
   * All versions must be compatible with [semver](https://semver.org/spec/v2.0.0.html) format.
   * If the version is not supported, we won't apply instrumentation patch (see `enable` method).
   * If omitted, all versions of the module will be patched.
   */
  supportedVersions?: string[];
}

export interface InstrumentationConfig {
  /**
   * Whether to enable the plugin.
   * @default true
   */
  enabled?: boolean;

  /**
   * Path of the trace plugin to load.
   * @default '@opentelemetry/plugin-http' in case of http.
   */
  path?: string;
}

/**
 * This interface defines the params that are be added to the wrapped function
 * using the "shimmer.wrap"
 */
export interface ShimWrapped {
  __wrapped: boolean;
  __unwrap: Function;
  __original: Function;
}
