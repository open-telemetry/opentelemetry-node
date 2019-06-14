/**
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

/**
 * A SpanContext represents the portion of a Span which must be serialized and
 * propagated along side of a distributed context.
 */
export interface SpanContext {
  /** The ID of the trace that this span belongs to. */
  traceId: string;
  /** The ID of the Span. */
  spanId: string;
  /**
   * Trace options to propagate.
   *
   * It is represented as 1 byte (bitmap). Bit to represent whether trace is
   * sampled or not.
   * SAMPLED_VALUE = 0x1 and NOT_SAMPLED_VALUE = 0x0;
   */
  traceOptions?: number;
  /**
   * Tracing-system-specific info to propagate.
   *
   * The tracestate field value is a `list` as defined below. The `list` is a
   * series of `list-members` separated by commas `,`, and a list-member is a
   * key/value pair separated by an equals sign `=`. Spaces and horizontal tabs
   * surrounding `list-members` are ignored. There can be a maximum of 32
   * `list-members` in a `list`.
   * More Info: https://www.w3.org/TR/trace-context/#tracestate-field
   *
   * Examples:
   *     Single tracing system (generic format):
   *         tracestate: rojo=00f067aa0ba902b7
   *     Multiple tracing systems (with different formatting):
   *         tracestate: rojo=00f067aa0ba902b7,congo=t61rcWkgMzE
   */
  traceState?: string;
}
