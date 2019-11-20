/*!
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

import { NoopLogger } from '@opentelemetry/core';
import { ReadableSpan } from '@opentelemetry/tracing';
import * as http from 'http';
import * as assert from 'assert';
import * as sinon from 'sinon';
import {
  CollectorExporter,
  CollectorExporterConfig,
} from '../../src/CollectorExporter';
import { OTCExportTraceServiceRequest } from '../../src/types';

import { ensureSpanIsCorrect, mockedReadableSpan } from '../helper';

const fakeRequest = {
  end: function() {},
  on: function() {},
  write: function() {},
};

const mockRes = {
  statusCode: 200,
};

const mockResError = {
  statusCode: 400,
};

describe('CollectorExporter', () => {
  let collectorExporter: CollectorExporter;
  let collectorExporterConfig: CollectorExporterConfig;
  let spyRequest: any;
  let spyWrite: any;
  let spans: ReadableSpan[];
  describe('export', () => {
    beforeEach(() => {
      spyRequest = sinon.stub(http, 'request').returns(fakeRequest as any);
      spyWrite = sinon.stub(fakeRequest, 'write');
      collectorExporterConfig = {
        hostName: 'foo',
        logger: new NoopLogger(),
        serviceName: 'bar',
        spanAttributes: {},
        url: 'http://foo.bar.com',
      };
      collectorExporter = new CollectorExporter(collectorExporterConfig);
      spans = [];
      spans.push(Object.assign({}, mockedReadableSpan));
    });
    afterEach(() => {
      spyRequest.restore();
      spyWrite.restore();
    });

    it('should open the connection', done => {
      collectorExporter.export(spans, function() {});

      setTimeout(() => {
        const args = spyRequest.args[0];
        const options = args[0];

        assert.strictEqual(options.hostname, 'foo.bar.com');
        assert.strictEqual(options.method, 'POST');
        assert.strictEqual(options.path, '/');
        assert.deepStrictEqual(options.headers, { 'Content-Length': 1652 });
        done();
      });
    });

    it('should successfully send the spans', done => {
      collectorExporter.export(spans, function() {});

      setTimeout(() => {
        const writeArgs = spyWrite.args[0];
        const json = JSON.parse(writeArgs[0]) as OTCExportTraceServiceRequest;
        const span1 = json.spans && json.spans[0];
        assert.ok(typeof span1 !== 'undefined', "span doesn't exist");
        if (span1) {
          ensureSpanIsCorrect(span1);
        }

        done();
      });
    });

    it('should log the successful message', done => {
      const spyLoggerDebug = sinon.stub(collectorExporter.logger, 'debug');
      const spyLoggerError = sinon.stub(collectorExporter.logger, 'error');

      collectorExporter.export(spans, function() {});

      setTimeout(() => {
        const args = spyRequest.args[0];
        const callback = args[1];
        callback(mockRes);

        const response: any = spyLoggerDebug.args[1][0];
        assert.strictEqual(response, 'statusCode: 200');
        assert.strictEqual(spyLoggerError.args.length, 0);
        done();
      });
    });

    it('should log the error message', done => {
      const spyLoggerError = sinon.stub(collectorExporter.logger, 'error');

      collectorExporter.export(spans, function() {});

      setTimeout(() => {
        // const response: any = spyLoggerDebug.args[0][0];
        const args = spyRequest.args[0];
        const callback = args[1];
        callback(mockResError);

        const response: any = spyLoggerError.args[0][0];
        assert.strictEqual(response, 'statusCode: 400');
        done();
      });
    });
  });
});
