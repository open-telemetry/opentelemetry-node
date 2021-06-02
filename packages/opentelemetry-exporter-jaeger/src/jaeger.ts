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

import { diag } from '@opentelemetry/api';
import { ExportResult, ExportResultCode, getEnv } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/tracing';
import { Socket } from 'dgram';
import { ResourceAttributes } from '@opentelemetry/semantic-conventions';
import { spanToThrift } from './transform';
import * as jaegerTypes from './types';

/**
 * Format and sends span information to Jaeger Exporter.
 */
export class JaegerExporter implements SpanExporter {
  private readonly _onShutdownFlushTimeout: number;
  private readonly _localConfig: jaegerTypes.ExporterConfig;
  private _isShutdown = false;
  private _shutdownFlushTimeout: NodeJS.Timeout | undefined;
  private _shuttingDownPromise: Promise<void> = Promise.resolve();

  private _sender?: typeof jaegerTypes.UDPSender;

  constructor(config?: jaegerTypes.ExporterConfig) {
    const localConfig = Object.assign({}, config);
    this._onShutdownFlushTimeout =
      typeof localConfig.flushTimeout === 'number'
        ? localConfig.flushTimeout
        : 2000;

    // https://github.com/jaegertracing/jaeger-client-node#environment-variables
    // By default, the client sends traces via UDP to the agent at localhost:6832. Use OTEL_EXPORTER_JAEGER_AGENT_HOST and
    // JAEGER_AGENT_PORT to send UDP traces to a different host:port. If OTEL_EXPORTER_JAEGER_ENDPOINT is set, the client sends traces
    // to the endpoint via HTTP, making the OTEL_EXPORTER_JAEGER_AGENT_HOST and JAEGER_AGENT_PORT unused. If OTEL_EXPORTER_JAEGER_ENDPOINT is secured,
    // HTTP basic authentication can be performed by setting the OTEL_EXPORTER_JAEGER_USER and OTEL_EXPORTER_JAEGER_PASSWORD environment variables.

    const env = getEnv();
    localConfig.endpoint =
      localConfig.endpoint || env.OTEL_EXPORTER_JAEGER_ENDPOINT;
    localConfig.username =
      localConfig.username || env.OTEL_EXPORTER_JAEGER_USER;
    localConfig.password =
      localConfig.password || env.OTEL_EXPORTER_JAEGER_PASSWORD;
    localConfig.host = localConfig.host || env.OTEL_EXPORTER_JAEGER_AGENT_HOST;

    this._localConfig = localConfig;
  }

  /** Exports a list of spans to Jaeger. */
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    if (spans.length === 0) {
      return resultCallback({ code: ExportResultCode.SUCCESS });
    }
    diag.debug('Jaeger exporter export');
    this._sendSpans(spans, resultCallback).catch(error => {
      return resultCallback({ code: ExportResultCode.FAILED, error });
    });
  }

  /** Shutdown exporter. */
  shutdown(): Promise<void> {
    if (this._isShutdown) {
      return this._shuttingDownPromise;
    }
    this._isShutdown = true;

    this._shuttingDownPromise = new Promise((resolve, reject) => {
      let rejected = false;
      this._shutdownFlushTimeout = setTimeout(() => {
        rejected = true;
        reject('timeout');
        this._sender.close();
      }, this._onShutdownFlushTimeout);

      Promise.resolve()
        .then(() => {
          // Make an optimistic flush.
          return this._flush();
        })
        .then(() => {
          if (rejected) {
            return;
          } else {
            this._shutdownFlushTimeout &&
              clearTimeout(this._shutdownFlushTimeout);
            resolve();
            this._sender.close();
          }
        })
        .catch(e => {
          reject(e);
        });
    });
    return this._shuttingDownPromise;
  }

  /** Transform spans and sends to Jaeger service. */
  private async _sendSpans(
    spans: ReadableSpan[],
    done?: (result: ExportResult) => void
  ) {
    const thriftSpan = spans.map(span => spanToThrift(span));
    for (const span of thriftSpan) {
      try {
        await this._append(span);
      } catch (error) {
        // TODO right now we break out on first error, is that desirable?
        if (done) return done({ code: ExportResultCode.FAILED, error });
      }
    }
    diag.debug('successful append for : %s', thriftSpan.length);

    // Flush all spans on each export. No-op if span buffer is empty
    await this._flush();

    if (done) return process.nextTick(done, { code: ExportResultCode.SUCCESS });
  }

  private async _append(span: jaegerTypes.ThriftSpan): Promise<number> {
    return new Promise((resolve, reject) => {
      this._getSender(span).append(span, (count: number, err?: string) => {
        if (err) {
          return reject(new Error(err));
        }
        resolve(count);
      });
    });
  }

  private _getSender(span: jaegerTypes.ThriftSpan): typeof jaegerTypes.UDPSender {
    if (this._sender) {
      return this._sender;
    }

    const sender = this._localConfig.endpoint ? new jaegerTypes.HTTPSender(this._localConfig) : new jaegerTypes.UDPSender(this._localConfig);

    if (sender._client instanceof Socket) {
      // unref socket to prevent it from keeping the process running
      sender._client.unref();
    }

    const serviceNameTag = span.tags.find(t => t.key === ResourceAttributes.SERVICE_NAME)
    const serviceName = serviceNameTag?.vStr || "unknown_service";

    sender.setProcess({
      serviceName,
      tags: jaegerTypes.ThriftUtils.getThriftTags(this._localConfig.tags || []),
    });

    this._sender = sender;
    return sender;
  }

  private async _flush(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      if (!this._sender) {
        return resolve();
      }

      this._sender.flush((_count: number, err?: string) => {
        if (err) {
          return reject(new Error(err));
        }
        diag.debug('successful flush for %s spans', _count);
        resolve();
      });
    });
  }
}
