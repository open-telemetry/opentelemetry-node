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

import { TextMapPropagator, Logger, Sampler } from '@opentelemetry/api';
import { LogLevel, IdGenerator } from '@opentelemetry/core';

import { ContextManager } from '@opentelemetry/context-base';
import { Resource } from '@opentelemetry/resources';

/**
 * TracerConfig provides an interface for configuring a Basic Tracer.
 */
export interface TracerConfig {
  /**
   * User provided logger.
   */
  logger?: Logger;

  /** level of logger.  */
  logLevel?: LogLevel;

  /**
   * Sampler determines if a span should be recorded or should be a NoopSpan.
   */
  sampler?: Sampler;

  /** Trace Parameters */
  traceParams?: TraceParams;

  /** Resource associated with trace telemetry  */
  resource?: Resource;

  /** Bool for whether or not graceful shutdown is enabled. If disabled spans will not be exported when SIGTERM is recieved */
  gracefulShutdown?: boolean;

  /**
   * Generator of trace and span IDs
   * The default idGenerator generates random ids
   */
  idGenerator?: IdGenerator;
}

/**
 * Configuration options for registering the API with the SDK.
 * Undefined values may be substituted for defaults, and null
 * values will not be registered.
 */
export interface SDKRegistrationConfig {
  /** Propagator to register as the global propagator */
  propagator?: TextMapPropagator | null;

  /** Context manager to register as the global context manager */
  contextManager?: ContextManager | null;
}

/** Global configuration of trace service */
export interface TraceParams {
  /** numberOfAttributesPerSpan is number of attributes per span */
  numberOfAttributesPerSpan?: number;
  /** numberOfLinksPerSpan is number of links per span */
  numberOfLinksPerSpan?: number;
  /** numberOfEventsPerSpan is number of message events per span */
  numberOfEventsPerSpan?: number;
  /** this field defines maximum length of attribute value before it is truncated */
  spanAttributeValueSizeLimit?: number | null;
}

/** Interface configuration for a buffer. */
export interface BufferConfig {
  /** Maximum size of a buffer. */
  bufferSize?: number;
  /** Max time for a buffer can wait before being sent */
  bufferTimeout?: number;
}
