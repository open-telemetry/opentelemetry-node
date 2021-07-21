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
import { SpanExporter, ReadableSpan } from '@opentelemetry/tracing';
import { prepareSend } from './platform/index';
import * as zipkinTypes from './types';
import {
  toZipkinSpan,
  statusCodeTagName,
  statusDescriptionTagName,
} from './transform';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { prepareGetHeaders } from './utils';

/**
 * Zipkin Exporter
 */
export class ZipkinExporter implements SpanExporter {
  private readonly DEFAULT_SERVICE_NAME = 'OpenTelemetry Service';
  private readonly _statusCodeTagName: string;
  private readonly _statusDescriptionTagName: string;
  private _urlStr: string;
  private _send: zipkinTypes.SendFunction;
  private _getHeaders: zipkinTypes.GetHeaders | undefined;
  private _serviceName?: string;
  private _isShutdown: boolean;
  private _sendingPromises: Promise<unknown>[] = [];

  constructor(config: zipkinTypes.ExporterConfig = {}) {
    this._urlStr = config.url || getEnv().OTEL_EXPORTER_ZIPKIN_ENDPOINT;
    this._send = prepareSend(this._urlStr, config.headers);
    this._serviceName = config.serviceName;
    this._statusCodeTagName = config.statusCodeTagName || statusCodeTagName;
    this._statusDescriptionTagName =
      config.statusDescriptionTagName || statusDescriptionTagName;
    this._isShutdown = false;
    if (typeof config.getExportRequestHeaders === 'function') {
      this._getHeaders = prepareGetHeaders(config.getExportRequestHeaders);
    } else {
      // noop
      this._beforeSend = function () {};
    }
  }

  /**
   * Export spans.
   */
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ) {
    const serviceName = String(
      this._serviceName ||
        spans[0].resource.attributes[SemanticResourceAttributes.SERVICE_NAME] ||
        this.DEFAULT_SERVICE_NAME
    );

    diag.debug('Zipkin exporter export');
    if (this._isShutdown) {
      setTimeout(() =>
        resultCallback({
          code: ExportResultCode.FAILED,
          error: new Error('Exporter has been shutdown'),
        })
      );
      return;
    }
    const promise = new Promise<void>(resolve => {
      this._sendSpans(spans, serviceName, result => {
        resolve();
        resultCallback(result);
        const index = this._sendingPromises.indexOf(promise);
        this._sendingPromises.splice(index, 1);
      });
    });
    this._sendingPromises.push(promise);
  }

  /**
   * Shutdown exporter. Noop operation in this exporter.
   */
  shutdown(): Promise<void> {
    diag.debug('Zipkin exporter shutdown');
    this._isShutdown = true;
    return new Promise((resolve, reject) => {
      Promise.all(this._sendingPromises).then(() => {
        resolve();
      }, reject);
    });
  }

  /**
   * if user defines getExportRequestHeaders in config then this will be called
   * everytime before send, otherwise it will be replaced with noop in
   * constructor
   * @default noop
   */
  private _beforeSend() {
    if (this._getHeaders) {
      this._send = prepareSend(this._urlStr, this._getHeaders());
    }
  }

  /**
   * Transform spans and sends to Zipkin service.
   */
  private _sendSpans(
    spans: ReadableSpan[],
    serviceName: string,
    done?: (result: ExportResult) => void
  ) {
    const zipkinSpans = spans.map(span =>
      toZipkinSpan(
        span,
        String(
          span.attributes[SemanticResourceAttributes.SERVICE_NAME] ||
            span.resource.attributes[SemanticResourceAttributes.SERVICE_NAME] ||
            serviceName
        ),
        this._statusCodeTagName,
        this._statusDescriptionTagName
      )
    );
    this._beforeSend();
    return this._send(zipkinSpans, (result: ExportResult) => {
      if (done) {
        return done(result);
      }
    });
  }
}
