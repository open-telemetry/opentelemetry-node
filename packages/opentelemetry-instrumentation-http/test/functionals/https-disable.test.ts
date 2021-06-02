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
import * as fs from 'fs';
import type { AddressInfo } from 'net';
import * as nock from 'nock';
import * as sinon from 'sinon';
import { HttpInstrumentation } from '../../src';
import { isWrapped } from '@opentelemetry/instrumentation';

const instrumentation = new HttpInstrumentation();
instrumentation.enable();
instrumentation.disable();

import * as https from 'https';
import { httpsRequest } from '../utils/httpsRequest';
import { INVALID_SPAN_CONTEXT, trace, TracerProvider } from '@opentelemetry/api';

describe('HttpsInstrumentation', () => {
  let server: https.Server;
  let serverPort = 0;

  describe('disable()', () => {
    let provider: TracerProvider;
    let startSpanStub: sinon.SinonStub;
  
    before(() => {
      provider = {
        getTracer: () => {
          startSpanStub = sinon.stub().returns(trace.wrapSpanContext(INVALID_SPAN_CONTEXT));
          return { startSpan: startSpanStub } as any;
        }
      };
      nock.cleanAll();
      nock.enableNetConnect();

      instrumentation.enable();
      assert.strictEqual(isWrapped(https.Server.prototype.emit), true);
      instrumentation.setTracerProvider(provider);

      server = https.createServer(
        {
          key: fs.readFileSync('test/fixtures/server-key.pem'),
          cert: fs.readFileSync('test/fixtures/server-cert.pem'),
        },
        (request, response) => {
          response.end('Test Server Response');
        }
      );

      server.listen(serverPort);
      server.once('listening', () => {
        serverPort = (server.address() as AddressInfo).port;
      });
    });

    afterEach(() => {
      sinon.restore();
    });

    after(() => {
      server.close();
    });
    describe('unpatch()', () => {
      it('should not call tracer methods for creating span', async () => {
        instrumentation.disable();
        const testPath = '/incoming/unpatch/';

        const options = { host: 'localhost', path: testPath, port: serverPort };

        await httpsRequest.get(options).then(() => {
          sinon.assert.notCalled(startSpanStub);
          assert.strictEqual(isWrapped(https.Server.prototype.emit), false);
        });
      });
    });
  });
});
