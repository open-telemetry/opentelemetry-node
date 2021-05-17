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

import { DiagLogLevel } from '@opentelemetry/api';
import { TracesSamplerValues } from './sampling';

const DEFAULT_LIST_SEPARATOR = ',';

/**
 * Environment interface to define all names
 */

const ENVIRONMENT_NUMBERS_KEYS = [
  'OTEL_BSP_EXPORT_TIMEOUT',
  'OTEL_BSP_MAX_EXPORT_BATCH_SIZE',
  'OTEL_BSP_MAX_QUEUE_SIZE',
  'OTEL_BSP_SCHEDULE_DELAY',
  'OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT',
  'OTEL_SPAN_EVENT_COUNT_LIMIT',
  'OTEL_SPAN_LINK_COUNT_LIMIT',
] as const;

type ENVIRONMENT_NUMBERS = {
  [K in typeof ENVIRONMENT_NUMBERS_KEYS[number]]?: number;
};

function isEnvVarANumber(key: unknown): key is keyof ENVIRONMENT_NUMBERS {
  return (
    ENVIRONMENT_NUMBERS_KEYS.indexOf(key as keyof ENVIRONMENT_NUMBERS) > -1
  );
}

const ENVIRONMENT_LISTS_KEYS = [
  'OTEL_NO_PATCH_MODULES',
  'OTEL_PROPAGATORS',
] as const;

type ENVIRONMENT_LISTS = {
  [K in typeof ENVIRONMENT_LISTS_KEYS[number]]?: string[];
};

function isEnvVarAList(key: unknown): key is keyof ENVIRONMENT_LISTS {
  return ENVIRONMENT_LISTS_KEYS.indexOf(key as keyof ENVIRONMENT_LISTS) > -1;
}

export type ENVIRONMENT = {
  CONTAINER_NAME?: string;
  ECS_CONTAINER_METADATA_URI_V4?: string;
  ECS_CONTAINER_METADATA_URI?: string;
  HOSTNAME?: string;
  KUBERNETES_SERVICE_HOST?: string;
  NAMESPACE?: string;
  OTEL_EXPORTER_JAEGER_AGENT_HOST?: string;
  OTEL_EXPORTER_JAEGER_ENDPOINT?: string;
  OTEL_EXPORTER_JAEGER_PASSWORD?: string;
  OTEL_EXPORTER_JAEGER_USER?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_METRICS_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_HEADERS?: string;
  OTEL_EXPORTER_OTLP_TRACES_HEADERS?: string;
  OTEL_EXPORTER_OTLP_METRICS_HEADERS?: string;
  OTEL_EXPORTER_ZIPKIN_ENDPOINT?: string;
  OTEL_LOG_LEVEL?: DiagLogLevel;
  OTEL_RESOURCE_ATTRIBUTES?: string;
  OTEL_TRACES_EXPORTER?: string;
  OTEL_TRACES_SAMPLER_ARG?: string;
  OTEL_TRACES_SAMPLER?: string;
} & ENVIRONMENT_NUMBERS &
  ENVIRONMENT_LISTS;

export type RAW_ENVIRONMENT = {
  [key: string]: string | number | undefined | string[];
};

/**
 * Default environment variables
 */
export const DEFAULT_ENVIRONMENT: Required<ENVIRONMENT> = {
  CONTAINER_NAME: '',
  ECS_CONTAINER_METADATA_URI_V4: '',
  ECS_CONTAINER_METADATA_URI: '',
  HOSTNAME: '',
  KUBERNETES_SERVICE_HOST: '',
  NAMESPACE: '',
  OTEL_BSP_EXPORT_TIMEOUT: 30000,
  OTEL_BSP_MAX_EXPORT_BATCH_SIZE: 512,
  OTEL_BSP_MAX_QUEUE_SIZE: 2048,
  OTEL_BSP_SCHEDULE_DELAY: 5000,
  OTEL_EXPORTER_JAEGER_AGENT_HOST: '',
  OTEL_EXPORTER_JAEGER_ENDPOINT: '',
  OTEL_EXPORTER_JAEGER_PASSWORD: '',
  OTEL_EXPORTER_JAEGER_USER: '',
  OTEL_EXPORTER_OTLP_ENDPOINT: '',
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: '',
  OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: '',
  OTEL_EXPORTER_OTLP_HEADERS: '',
  OTEL_EXPORTER_OTLP_TRACES_HEADERS: '',
  OTEL_EXPORTER_OTLP_METRICS_HEADERS: '',
  OTEL_EXPORTER_ZIPKIN_ENDPOINT: 'http://localhost:9411/api/v2/spans',
  OTEL_LOG_LEVEL: DiagLogLevel.INFO,
  OTEL_NO_PATCH_MODULES: [],
  OTEL_PROPAGATORS: ['tracecontext', 'baggage'],
  OTEL_RESOURCE_ATTRIBUTES: '',
  OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT: 128,
  OTEL_SPAN_EVENT_COUNT_LIMIT: 128,
  OTEL_SPAN_LINK_COUNT_LIMIT: 128,
  OTEL_TRACES_EXPORTER: 'none',
  OTEL_TRACES_SAMPLER: TracesSamplerValues.ParentBasedAlwaysOn,
  OTEL_TRACES_SAMPLER_ARG: '',
};

/**
 * Parses a variable as number with number validation
 * @param name
 * @param environment
 * @param values
 * @param min
 * @param max
 */
function parseNumber(
  name: keyof ENVIRONMENT_NUMBERS,
  environment: ENVIRONMENT,
  values: RAW_ENVIRONMENT,
  min = -Infinity,
  max = Infinity
) {
  if (typeof values[name] !== 'undefined') {
    const value = Number(values[name] as string);
    if (!isNaN(value)) {
      if (value < min) {
        environment[name] = min;
      } else if (value > max) {
        environment[name] = max;
      } else {
        environment[name] = value;
      }
    }
  }
}

/**
 * Parses list-like strings from input into output.
 * @param name
 * @param environment
 * @param values
 * @param separator
 */
function parseStringList(
  name: keyof ENVIRONMENT_LISTS,
  output: ENVIRONMENT,
  input: RAW_ENVIRONMENT,
  separator = DEFAULT_LIST_SEPARATOR
) {
  const givenValue = input[name];
  if (typeof givenValue === 'string') {
    output[name] = givenValue.split(separator).map(v => v.trim());
  }
}

// The support string -> DiagLogLevel mappings
const logLevelMap: { [key: string]: DiagLogLevel } = {
  ALL: DiagLogLevel.ALL,
  VERBOSE: DiagLogLevel.VERBOSE,
  DEBUG: DiagLogLevel.DEBUG,
  INFO: DiagLogLevel.INFO,
  WARN: DiagLogLevel.WARN,
  ERROR: DiagLogLevel.ERROR,
  NONE: DiagLogLevel.NONE,
};

/**
 * Environmentally sets log level if valid log level string is provided
 * @param key
 * @param environment
 * @param values
 */
function setLogLevelFromEnv(
  key: keyof ENVIRONMENT,
  environment: RAW_ENVIRONMENT | ENVIRONMENT,
  values: RAW_ENVIRONMENT
) {
  const value = values[key];
  if (typeof value === 'string') {
    const theLevel = logLevelMap[value.toUpperCase()];
    if (theLevel != null) {
      environment[key] = theLevel;
    }
  }
}

/**
 * Parses environment values
 * @param values
 */
export function parseEnvironment(values: RAW_ENVIRONMENT): ENVIRONMENT {
  const environment: ENVIRONMENT = {};

  for (const env in DEFAULT_ENVIRONMENT) {
    const key = env as keyof ENVIRONMENT;

    switch (key) {
      case 'OTEL_LOG_LEVEL':
        setLogLevelFromEnv(key, environment, values);
        break;

      default:
        if (isEnvVarANumber(key)) {
          parseNumber(key, environment, values);
        } else if (isEnvVarAList(key)) {
          parseStringList(key, environment, values);
        } else {
          const value = values[key];
          if (typeof value !== 'undefined' && value !== null) {
            environment[key] = String(value);
          }
        }
    }
  }

  return environment;
}
