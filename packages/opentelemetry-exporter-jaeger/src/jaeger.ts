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

import * as api from '@opentelemetry/api';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/tracing';
import { Socket } from 'dgram';
import { spanToThrift } from './transform';
import * as jaegerTypes from './types';

/**
 * Format and sends span information to Jaeger Exporter.
 */
export class JaegerExporter implements SpanExporter {
  private readonly _logger: api.Logger;
  private readonly _process: jaegerTypes.ThriftProcess;
  private readonly _sender: typeof jaegerTypes.UDPSender;
  private readonly _onShutdownFlushTimeout: number;
  private _isShutdown = false;
  private _shutdownFlushTimeout: NodeJS.Timeout | undefined;
  private _shuttingDownPromise: Promise<void> = Promise.resolve();

  constructor(config: jaegerTypes.ExporterConfig) {
    const localConfig = Object.assign({}, config);
    this._logger = localConfig.logger || new api.NoopLogger();
    const tags: jaegerTypes.Tag[] = localConfig.tags || [];
    this._onShutdownFlushTimeout =
      typeof localConfig.flushTimeout === 'number'
        ? localConfig.flushTimeout
        : 2000;

    // https://github.com/jaegertracing/jaeger-client-node#environment-variables
    // By default, the client sends traces via UDP to the agent at localhost:6832. Use JAEGER_AGENT_HOST and
    // JAEGER_AGENT_PORT to send UDP traces to a different host:port. If JAEGER_ENDPOINT is set, the client sends traces
    // to the endpoint via HTTP, making the JAEGER_AGENT_HOST and JAEGER_AGENT_PORT unused. If JAEGER_ENDPOINT is secured,
    // HTTP basic authentication can be performed by setting the JAEGER_USER and JAEGER_PASSWORD environment variables.
    localConfig.endpoint = localConfig.endpoint || process.env.JAEGER_ENDPOINT;
    localConfig.username = localConfig.username || process.env.JAEGER_USER;
    localConfig.password = localConfig.password || process.env.JAEGER_PASSWORD;
    localConfig.host = localConfig.host || process.env.JAEGER_AGENT_HOST;
    if (process.env.JAEGER_SERVICE_NAME) {
      localConfig.serviceName = process.env.JAEGER_SERVICE_NAME;
    }
    if (localConfig.endpoint) {
      this._sender = new jaegerTypes.HTTPSender(localConfig);
    } else {
      this._sender = localConfig.endpoint = new jaegerTypes.UDPSender(
        localConfig
      );
    }

    if (this._sender._client instanceof Socket) {
      // unref socket to prevent it from keeping the process running
      this._sender._client.unref();
    }

    this._process = {
      serviceName: localConfig.serviceName,
      tags: jaegerTypes.ThriftUtils.getThriftTags(tags),
    };
    this._sender.setProcess(this._process);
  }

  /** Exports a list of spans to Jaeger. */
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    if (spans.length === 0) {
      return resultCallback({ code: ExportResultCode.SUCCESS });
    }
    this._logger.debug('Jaeger exporter export');
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
    this._logger.debug('successful append for : %s', thriftSpan.length);

    // Flush all spans on each export. No-op if span buffer is empty
    await this._flush();

    if (done) return done({ code: ExportResultCode.SUCCESS });
  }

  private async _append(span: jaegerTypes.ThriftSpan): Promise<number> {
    return new Promise((resolve, reject) => {
      this._sender.append(span, (count: number, err?: string) => {
        if (err) {
          return reject(new Error(err));
        }
        resolve(count);
      });
    });
  }

  private async _flush(): Promise<void> {
    await new Promise((resolve, reject) => {
      this._sender.flush((_count: number, err?: string) => {
        if (err) {
          return reject(new Error(err));
        }
        this._logger.debug('successful flush for %s spans', _count);
        resolve();
      });
    });
  }
}
