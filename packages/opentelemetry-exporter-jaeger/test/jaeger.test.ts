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

import * as assert from 'assert';
import { JaegerExporter } from '../src';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import * as api from '@opentelemetry/api';
import { ThriftProcess } from '../src/types';
import { ReadableSpan } from '@opentelemetry/tracing';
import { TraceFlags } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import * as nock from 'nock';
import { ResourceAttributes } from '@opentelemetry/semantic-conventions';

describe('JaegerExporter', () => {
  const readableSpan: ReadableSpan = {
    name: 'my-span1',
    kind: api.SpanKind.CLIENT,
    spanContext: () => {
      return {
        traceId: 'd4cda95b652f4a1592b449d5929fda1b',
        spanId: '6e0c63257de34c92',
        traceFlags: TraceFlags.NONE,
      };
    },
    startTime: [1566156729, 709],
    endTime: [1566156731, 709],
    ended: true,
    status: {
      code: api.SpanStatusCode.ERROR,
    },
    attributes: {},
    links: [],
    events: [],
    duration: [32, 800000000],
    resource: new Resource({
      [ResourceAttributes.SERVICE_NAME]: 'opentelemetry'
    }),
    instrumentationLibrary: {
      name: 'default',
      version: '0.0.1',
    },
  };
  describe('constructor', () => {
    afterEach(() => {
      delete process.env.OTEL_EXPORTER_JAEGER_AGENT_HOST;
    });

    it('should construct an exporter', () => {
      const exporter = new JaegerExporter();
      assert.ok(typeof exporter.export === 'function');
      assert.ok(typeof exporter.shutdown === 'function');
    });

    it('should get service name from the the service name resource attribute of the first exported span', done => {
      const mockedEndpoint = 'http://testendpoint';
      const scope =nock(mockedEndpoint)
        .post('/')
        .reply(202)
        
      const exporter = new JaegerExporter({
        endpoint: mockedEndpoint,
      });
      exporter.export([readableSpan], result => {
        assert.strictEqual(result.code, ExportResultCode.SUCCESS);
        assert.strictEqual(exporter['_sender']._batch.process.serviceName, 'opentelemetry');
        scope.done();
        done();
      });
    });

    it('should construct an exporter with host, port, logger and tags', () => {
      const exporter = new JaegerExporter({
        host: 'remotehost',
        port: 8080,
        tags: [{ key: 'opentelemetry-exporter-jaeger', value: '0.1.0' }],
      });
      assert.ok(typeof exporter.export === 'function');
      assert.ok(typeof exporter.shutdown === 'function');

      const process: ThriftProcess = exporter['_getSender']({
        tags: [{
          key: "service.name",
          vStr: "opentelemetry"
        }]
      } as any)._process;
      assert.strictEqual(exporter['_sender']._host, 'remotehost');
      assert.strictEqual(process.serviceName, 'opentelemetry');
      assert.strictEqual(process.tags.length, 1);
      assert.strictEqual(process.tags[0].key, 'opentelemetry-exporter-jaeger');
      assert.strictEqual(process.tags[0].vType, 'STRING');
      assert.strictEqual(process.tags[0].vStr, '0.1.0');
    });

    it('should default to localhost if no host is configured', () => {
      const exporter = new JaegerExporter();
      const sender = exporter['_getSender']({
        tags: [{
          key: "service.name",
          vStr: "opentelemetry"
        }]
      } as any);
      assert.strictEqual(sender._host, 'localhost');
    });

    it('should respect jaeger host env variable', () => {
      process.env.OTEL_EXPORTER_JAEGER_AGENT_HOST = 'env-set-host';
      const exporter = new JaegerExporter();
      const sender = exporter['_getSender']({
        tags: [{
          key: "service.name",
          vStr: "opentelemetry"
        }]
      } as any);
      assert.strictEqual(sender._host, 'env-set-host');
    });

    it('should prioritize host option over env variable', () => {
      process.env.OTEL_EXPORTER_JAEGER_AGENT_HOST = 'env-set-host';
      const exporter = new JaegerExporter({
        host: 'option-set-host',
      });
      const sender = exporter['_getSender']({
        tags: [{
          key: "service.name",
          vStr: "opentelemetry"
        }]
      } as any);
      assert.strictEqual(sender._host, 'option-set-host');
    });

    it('should construct an exporter with flushTimeout', () => {
      const exporter = new JaegerExporter({
        flushTimeout: 5000,
      });
      assert.ok(typeof exporter.export === 'function');
      assert.ok(typeof exporter.shutdown === 'function');

      assert.strictEqual(exporter['_onShutdownFlushTimeout'], 5000);
    });

    it('should construct an exporter without flushTimeout', () => {
      const exporter = new JaegerExporter();
      assert.ok(typeof exporter.export === 'function');
      assert.ok(typeof exporter.shutdown === 'function');

      assert.strictEqual(exporter['_onShutdownFlushTimeout'], 2000);
    });
  });

  describe('export', () => {
    let exporter: JaegerExporter;

    beforeEach(() => {
      exporter = new JaegerExporter();
    });

    afterEach(() => {
      exporter.shutdown();
    });

    it('should skip send with empty list', () => {
      exporter.export([], (result: ExportResult) => {
        assert.strictEqual(result.code, ExportResultCode.SUCCESS);
      });
    });

    it('should send spans to Jaeger backend and return with Success', () => {
      exporter.export([readableSpan], (result: ExportResult) => {
        assert.strictEqual(result.code, ExportResultCode.SUCCESS);
      });
    });

    it('should use httpSender if config.endpoint is set', done => {
      const mockedEndpoint = 'http://testendpoint';
      nock(mockedEndpoint)
        .post('/')
        .reply(function () {
          assert.strictEqual(
            this.req.headers['content-type'],
            'application/x-thrift'
          );
          assert.strictEqual(this.req.headers.host, 'testendpoint');
        });
      const exporter = new JaegerExporter({
        endpoint: mockedEndpoint,
      });
      exporter.export([readableSpan], () => {
        assert.strictEqual(exporter['_sender'].constructor.name, 'HTTPSender');
        done();
      });
    });

    it('should return failed export result on error', () => {
      nock.cleanAll();
      const expectedError = new Error('whoops');
      const mockedEndpoint = 'http://testendpoint';
      const scope = nock(mockedEndpoint)
        .post('/')
        .replyWithError(expectedError);
      const exporter = new JaegerExporter({
        endpoint: mockedEndpoint,
      });

      exporter.export([readableSpan], result => {
        scope.done();
        assert.strictEqual(result.code, ExportResultCode.FAILED);
        assert.ok(result.error?.message.includes(expectedError.message));
      });
    });
  });
});
