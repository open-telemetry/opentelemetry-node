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

import * as crypto from 'crypto';
import * as api from '@opentelemetry/api';

const SPAN_ID_BYTES = 8;
const TRACE_ID_BYTES = 16;
const TIME_BYTES = 4;

export class AWSXrayIdGenerator implements api.IdGenerator {
  private SpanIdBytes: number = SPAN_ID_BYTES;
  private TraceIdBytes: number = TRACE_ID_BYTES;

  /**
   * Returns a random 16-byte trace ID formatted/encoded as a 32 lowercase hex
   * characters corresponding to 128 bits.
   * And in AWS Xray Exporter, the first 4 bytes originate from the current
   * time (unit: second)
   */
  GenerateTraceId(): string {
    var nowSec = Math.floor(Date.now() / 1000).toString(16);
    return nowSec + crypto.randomBytes(this.TraceIdBytes - TIME_BYTES).toString('hex');
  }

  /**
   * Returns a random 8-byte span ID formatted/encoded as a 16 lowercase hex
   * characters corresponding to 64 bits.
   */
  GenerateSpanId(): string {
    return crypto.randomBytes(this.SpanIdBytes).toString('hex');
  }
}