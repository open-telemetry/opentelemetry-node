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
  DEFAULT_CONFIG,
  DEFAULT_MAX_ATTRIBUTES_PER_SPAN,
  DEFAULT_MAX_EVENTS_PER_SPAN,
  DEFAULT_MAX_LINKS_PER_SPAN,
} from './config';
import { TracerConfig } from './types';
import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  getEnv,
} from '@opentelemetry/core';

/**
 * Function to merge Default configuration (as specified in './config') with
 * user provided configurations.
 */
export function mergeConfig(userConfig: TracerConfig) {
  const traceParams = userConfig.traceParams;
  const otelSamplingProbability = getEnv().OTEL_SAMPLING_PROBABILITY;

  const target = Object.assign(
    DEFAULT_CONFIG,
    // use default AlwaysOnSampler if otelSamplingProbability is 1
    otelSamplingProbability !== undefined && otelSamplingProbability < 1
      ? {
          sampler: new ParentBasedSampler({
            root: new TraceIdRatioBasedSampler(otelSamplingProbability),
          }),
        }
      : {},
    userConfig
  );

  // the user-provided value will be used to extend the default value.
  if (traceParams) {
    target.traceParams.numberOfAttributesPerSpan =
      traceParams.numberOfAttributesPerSpan || DEFAULT_MAX_ATTRIBUTES_PER_SPAN;
    target.traceParams.numberOfEventsPerSpan =
      traceParams.numberOfEventsPerSpan || DEFAULT_MAX_EVENTS_PER_SPAN;
    target.traceParams.numberOfLinksPerSpan =
      traceParams.numberOfLinksPerSpan || DEFAULT_MAX_LINKS_PER_SPAN;
    target.traceParams.spanAttributeValueSizeLimit =
      target.traceParams.spanAttributeValueSizeLimit ||
      getEnv().OTEL_SPAN_ATTRIBUTE_VALUE_SIZE_LIMIT;
  }
  return target;
}
