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
import { SpanContext, HttpTextFormat } from '@opentelemetry/types';
import * as http from 'http';

export class DummyPropagation implements HttpTextFormat {
  static TRACE_CONTEXT_KEY = 'x-dummy-trace-id';
  static SPAN_CONTEXT_KEY = 'x-dummy-span-id';
  extract(format: string, carrier: unknown): SpanContext {
    return {
      traceId: 'ca35dd5daef1401de22bcee7b7069195',
      spanId: DummyPropagation.SPAN_CONTEXT_KEY,
    };
  }
  inject(
    spanContext: SpanContext,
    format: string,
    headers: http.IncomingHttpHeaders
  ): void {
    headers[DummyPropagation.TRACE_CONTEXT_KEY] =
      spanContext.traceId || 'undefined';
    headers[DummyPropagation.SPAN_CONTEXT_KEY] =
      spanContext.spanId || 'undefined';
  }
}
