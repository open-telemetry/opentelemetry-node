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

import { SpanAttributes, TextMapPropagator, Sampler } from '@opentelemetry/api';
import type { ContextManager } from '@opentelemetry/api';
import { InstrumentationOption } from '@opentelemetry/instrumentation';
import { MetricExporter, Processor } from '@opentelemetry/metrics';
import { Resource } from '@opentelemetry/resources';
import {
  SpanExporter,
  SpanProcessor,
  SpanLimits,
} from '@opentelemetry/tracing';

export interface NodeSDKConfiguration {
  autoDetectResources: boolean;
  contextManager: ContextManager;
  defaultAttributes: SpanAttributes;
  textMapPropagator: TextMapPropagator;
  metricProcessor: Processor;
  metricExporter: MetricExporter;
  metricInterval: number;
  instrumentations: InstrumentationOption[];
  resource: Resource;
  sampler: Sampler;
  spanProcessor: SpanProcessor;
  traceExporter: SpanExporter;
  spanLimits: SpanLimits;
}
