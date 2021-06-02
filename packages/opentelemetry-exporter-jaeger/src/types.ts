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

/**
 * Options for Jaeger configuration
 */
export interface ExporterConfig {
  tags?: Tag[];
  host?: string; // default: 'localhost'
  port?: number; // default: 6832
  maxPacketSize?: number; // default: 65000
  /** Time to wait for an onShutdown flush to finish before closing the sender */
  flushTimeout?: number; // default: 2000
  //The HTTP endpoint for sending spans directly to a collector, i.e. http://jaeger-collector:14268/api/traces
  //If setten will override host and port
  endpoint?: string;
  //Username to send as part of "Basic" authentication to the collector endpoint
  username?: string;
  //Password to send as part of "Basic" authentication to the collector endpoint
  password?: string;
}

// Below require is needed as jaeger-client types does not expose the thrift,
// udp_sender, util etc. modules.

/* eslint-disable @typescript-eslint/no-var-requires */
export const UDPSender = require('jaeger-client/dist/src/reporters/udp_sender')
  .default;
export const Utils = require('jaeger-client/dist/src/util').default;
export const ThriftUtils = require('jaeger-client/dist/src/thrift').default;

export const HTTPSender = require('jaeger-client/dist/src/reporters/http_sender')
  .default;
/* eslint-enable @typescript-eslint/no-var-requires */

export type TagValue = string | number | boolean;

export interface Tag {
  key: string;
  value: TagValue;
}

export interface Log {
  timestamp: number;
  fields: Tag[];
}

export type SenderCallback = (numSpans: number, err?: string) => void;

export interface ThriftProcess {
  serviceName: string;
  tags: ThriftTag[];
}

export interface ThriftTag {
  key: string;
  vType: string;
  vStr: string;
  vDouble: number;
  vBool: boolean;
}

export interface ThriftLog {
  timestamp: number;
  fields: ThriftTag[];
}

export enum ThriftReferenceType {
  CHILD_OF = 'CHILD_OF',
  FOLLOWS_FROM = 'FOLLOWS_FROM',
}

export interface ThriftReference {
  traceIdLow: Buffer;
  traceIdHigh: Buffer;
  spanId: Buffer;
  refType: ThriftReferenceType;
}

export interface ThriftSpan {
  traceIdLow: Buffer;
  traceIdHigh: Buffer;
  spanId: Buffer;
  parentSpanId: string | Buffer;
  operationName: string;
  references: ThriftReference[];
  flags: number;
  startTime: number; // milliseconds
  duration: number; // milliseconds
  tags: ThriftTag[];
  logs: ThriftLog[];
}
