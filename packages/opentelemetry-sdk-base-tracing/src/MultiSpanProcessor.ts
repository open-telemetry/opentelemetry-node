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

import { Context } from '@opentelemetry/api';
import { globalErrorHandler } from '@opentelemetry/core';
import { ReadableSpan } from './export/ReadableSpan';
import { Span } from './Span';
import { SpanProcessor } from './SpanProcessor';

/**
 * Implementation of the {@link SpanProcessor} that simply forwards all
 * received events to a list of {@link SpanProcessor}s.
 */
export class MultiSpanProcessor implements SpanProcessor {
  constructor(private readonly _spanProcessors: SpanProcessor[]) {}

  forceFlush(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const spanProcessor of this._spanProcessors) {
      promises.push(spanProcessor.forceFlush());
    }
    return new Promise(resolve => {
      Promise.all(promises)
        .then(() => {
          resolve();
        })
        .catch(error => {
          globalErrorHandler(
            error || new Error('MultiSpanProcessor: forceFlush failed')
          );
          resolve();
        });
    });
  }

  onStart(span: Span, context: Context): void {
    for (const spanProcessor of this._spanProcessors) {
      spanProcessor.onStart(span, context);
    }
  }

  onEnd(span: ReadableSpan): void {
    for (const spanProcessor of this._spanProcessors) {
      spanProcessor.onEnd(span);
    }
  }

  shutdown(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const spanProcessor of this._spanProcessors) {
      promises.push(spanProcessor.shutdown());
    }
    return new Promise((resolve, reject) => {
      Promise.all(promises).then(() => {
        resolve();
      }, reject);
    });
  }
}
