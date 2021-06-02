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

import {
  context,
  propagation,
  ProxyTracerProvider,
  trace,
  diag,
  DiagLogLevel,
} from '@opentelemetry/api';
import { metrics, NoopMeterProvider } from '@opentelemetry/api-metrics';
import {
  AsyncHooksContextManager,
  AsyncLocalStorageContextManager,
} from '@opentelemetry/context-async-hooks';
import { CompositePropagator } from '@opentelemetry/core';
import { ConsoleMetricExporter, MeterProvider } from '@opentelemetry/metrics';
import { NodeTracerProvider } from '@opentelemetry/node';
import { awsEc2Detector } from '@opentelemetry/resource-detector-aws';
import { resetIsAvailableCache } from '@opentelemetry/resource-detector-gcp';
import { Resource } from '@opentelemetry/resources';
import {
  assertCloudResource,
  assertHostResource,
  assertServiceResource,
} from '@opentelemetry/resources/build/test/util/resource-assertions';
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/tracing';
import * as assert from 'assert';
import {
  BASE_PATH,
  HEADER_NAME,
  HEADER_VALUE,
  HOST_ADDRESS,
  SECONDARY_HOST_ADDRESS,
} from 'gcp-metadata';
import * as nock from 'nock';
import * as semver from 'semver';
import * as Sinon from 'sinon';
import { NodeSDK } from '../src';

const HEADERS = {
  [HEADER_NAME.toLowerCase()]: HEADER_VALUE,
};
const INSTANCE_PATH = BASE_PATH + '/instance';
const INSTANCE_ID_PATH = BASE_PATH + '/instance/id';
const PROJECT_ID_PATH = BASE_PATH + '/project/project-id';
const ZONE_PATH = BASE_PATH + '/instance/zone';
const CLUSTER_NAME_PATH = BASE_PATH + '/instance/attributes/cluster-name';

const AWS_HOST = 'http://' + awsEc2Detector.AWS_IDMS_ENDPOINT;
const AWS_TOKEN_PATH = awsEc2Detector.AWS_INSTANCE_TOKEN_DOCUMENT_PATH;
const AWS_IDENTITY_PATH = awsEc2Detector.AWS_INSTANCE_IDENTITY_DOCUMENT_PATH;
const AWS_HOST_PATH = awsEc2Detector.AWS_INSTANCE_HOST_DOCUMENT_PATH;
const AWS_METADATA_TTL_HEADER = awsEc2Detector.AWS_METADATA_TTL_HEADER;
const AWS_METADATA_TOKEN_HEADER = awsEc2Detector.AWS_METADATA_TOKEN_HEADER;

const mockedTokenResponse = 'my-token';
const mockedIdentityResponse = {
  instanceId: 'my-instance-id',
  instanceType: 'my-instance-type',
  accountId: 'my-account-id',
  region: 'my-region',
  availabilityZone: 'my-zone',
};
const mockedHostResponse = 'my-hostname';

const DefaultContextManager = semver.gte(process.version, '14.8.0')
  ? AsyncLocalStorageContextManager
  : AsyncHooksContextManager;

describe('Node SDK', () => {
  let ctxManager: any;
  let propagator: any;
  let delegate: any;

  before(() => {
    nock.disableNetConnect();
  });

  beforeEach(() => {
    context.disable();
    trace.disable();
    propagation.disable();
    metrics.disable();

    ctxManager = context['_getContextManager']();
    propagator = propagation['_getGlobalPropagator']();
    delegate = (trace.getTracerProvider() as ProxyTracerProvider).getDelegate();
  });

  describe('Basic Registration', () => {
    it('should not register any unconfigured SDK components', async () => {
      const sdk = new NodeSDK({
        autoDetectResources: false,
      });

      await sdk.start();

      assert.strictEqual(context['_getContextManager'](), ctxManager, "context manager should not change");
      assert.strictEqual(propagation['_getGlobalPropagator'](), propagator, "propagator should not change");
      assert.strictEqual((trace.getTracerProvider() as ProxyTracerProvider).getDelegate(), delegate, "tracer provider should not have changed");

      assert.ok(metrics.getMeterProvider() instanceof NoopMeterProvider);
    });

    it('should register a tracer provider if an exporter is provided', async () => {
      const sdk = new NodeSDK({
        traceExporter: new ConsoleSpanExporter(),
        autoDetectResources: false,
      });

      await sdk.start();

      assert.ok(metrics.getMeterProvider() instanceof NoopMeterProvider);

      assert.ok(
        context['_getContextManager']() instanceof DefaultContextManager
      );
      assert.ok(
        propagation['_getGlobalPropagator']() instanceof CompositePropagator
      );
      const apiTracerProvider = trace.getTracerProvider() as ProxyTracerProvider;
      assert.ok(apiTracerProvider.getDelegate() instanceof NodeTracerProvider);
    });

    it('should register a tracer provider if a span processor is provided', async () => {
      const exporter = new ConsoleSpanExporter();
      const spanProcessor = new SimpleSpanProcessor(exporter);

      const sdk = new NodeSDK({
        spanProcessor,
        autoDetectResources: false,
      });

      await sdk.start();

      assert.ok(metrics.getMeterProvider() instanceof NoopMeterProvider);

      assert.ok(
        context['_getContextManager']() instanceof DefaultContextManager
      );
      assert.ok(
        propagation['_getGlobalPropagator']() instanceof CompositePropagator
      );
      const apiTracerProvider = trace.getTracerProvider() as ProxyTracerProvider;
      assert.ok(apiTracerProvider.getDelegate() instanceof NodeTracerProvider);
    });

    it('should register a meter provider if an exporter is provided', async () => {
      const exporter = new ConsoleMetricExporter();

      const sdk = new NodeSDK({
        metricExporter: exporter,
        autoDetectResources: false,
      });

      await sdk.start();

      assert.strictEqual(context['_getContextManager'](), ctxManager, "context manager should not change");
      assert.strictEqual(propagation['_getGlobalPropagator'](), propagator, "propagator should not change");
      assert.strictEqual((trace.getTracerProvider() as ProxyTracerProvider).getDelegate(), delegate, "tracer provider should not have changed");

      assert.ok(metrics.getMeterProvider() instanceof MeterProvider);
    });
  });

  describe('detectResources', async () => {
    beforeEach(() => {
      nock.disableNetConnect();
      process.env.OTEL_RESOURCE_ATTRIBUTES =
        'service.instance.id=627cc493,service.name=my-service,service.namespace=default,service.version=0.0.1';
    });

    afterEach(() => {
      nock.cleanAll();
      nock.enableNetConnect();
      delete process.env.OTEL_RESOURCE_ATTRIBUTES;
    });

    // GCP detector only works in 10+
    (semver.satisfies(process.version, '>=10') ? describe : describe.skip)(
      'in GCP environment',
      () => {
        after(() => {
          resetIsAvailableCache();
        });

        it('returns a merged resource', async () => {
          const sdk = new NodeSDK({
            autoDetectResources: true,
          });
          const gcpScope = nock(HOST_ADDRESS)
            .get(INSTANCE_PATH)
            .reply(200, {}, HEADERS)
            .get(INSTANCE_ID_PATH)
            .reply(200, () => 452003179927758, HEADERS)
            .get(PROJECT_ID_PATH)
            .reply(200, () => 'my-project-id', HEADERS)
            .get(ZONE_PATH)
            .reply(200, () => 'project/zone/my-zone', HEADERS)
            .get(CLUSTER_NAME_PATH)
            .reply(404);
          const gcpSecondaryScope = nock(SECONDARY_HOST_ADDRESS)
            .get(INSTANCE_PATH)
            .reply(200, {}, HEADERS);
          const awsScope = nock(AWS_HOST)
            .persist()
            .put(AWS_TOKEN_PATH)
            .matchHeader(AWS_METADATA_TTL_HEADER, '60')
            .replyWithError({ code: 'ENOTFOUND' });
          await sdk.detectResources();
          const resource = sdk['_resource'];

          awsScope.done();
          gcpSecondaryScope.done();
          gcpScope.done();

          assertCloudResource(resource, {
            provider: 'gcp',
            accountId: 'my-project-id',
            zone: 'my-zone',
          });
          assertHostResource(resource, { id: '452003179927758' });
          assertServiceResource(resource, {
            instanceId: '627cc493',
            name: 'my-service',
            namespace: 'default',
            version: '0.0.1',
          });
        });
      }
    );

    describe('in AWS environment', () => {
      it('returns a merged resource', async () => {
        const sdk = new NodeSDK({
          autoDetectResources: true,
        });
        const awsScope = nock(AWS_HOST)
          .persist()
          .put(AWS_TOKEN_PATH)
          .matchHeader(AWS_METADATA_TTL_HEADER, '60')
          .reply(200, () => mockedTokenResponse)
          .get(AWS_IDENTITY_PATH)
          .matchHeader(AWS_METADATA_TOKEN_HEADER, mockedTokenResponse)
          .reply(200, () => mockedIdentityResponse)
          .get(AWS_HOST_PATH)
          .matchHeader(AWS_METADATA_TOKEN_HEADER, mockedTokenResponse)
          .reply(200, () => mockedHostResponse);
        await sdk.detectResources();
        const resource: Resource = sdk['_resource'];
        awsScope.done();

        assertCloudResource(resource, {
          provider: 'aws',
          accountId: 'my-account-id',
          region: 'my-region',
          zone: 'my-zone',
        });
        assertHostResource(resource, {
          id: 'my-instance-id',
          hostType: 'my-instance-type',
          name: 'my-hostname',
          hostName: 'my-hostname',
        });
        assertServiceResource(resource, {
          instanceId: '627cc493',
          name: 'my-service',
          namespace: 'default',
          version: '0.0.1',
        });
      });
    });

    describe('in no environment', () => {
      it('should return empty resource', async () => {
        const scope = nock(AWS_HOST).put(AWS_TOKEN_PATH).replyWithError({
          code: 'ENOTFOUND',
        });
        const sdk = new NodeSDK({
          autoDetectResources: true,
        });
        await sdk.detectResources({
          detectors: [awsEc2Detector],
        });
        const resource: Resource = sdk['_resource'];
        assert.ok(resource);
        assert.deepStrictEqual(resource, Resource.empty());

        scope.done();
      });
    });

    describe('with a buggy detector', () => {
      it('returns a merged resource', async () => {
        const sdk = new NodeSDK({
          autoDetectResources: true,
        });
        const stub = Sinon.stub(awsEc2Detector, 'detect').throws();
        await sdk.detectResources();
        const resource = sdk['_resource'];

        assertServiceResource(resource, {
          instanceId: '627cc493',
          name: 'my-service',
          namespace: 'default',
          version: '0.0.1',
        });

        stub.restore();
      });
    });

    describe('with a debug logger', () => {
      // Local functions to test if a mocked method is ever called with a specific argument or regex matching for an argument.
      // Needed because of race condition with parallel detectors.
      const callArgsContains = (
        mockedFunction: sinon.SinonSpy,
        arg: any
      ): boolean => {
        return mockedFunction.getCalls().some(call => {
          return call.args.some(callarg => arg === callarg);
        });
      };
      const callArgsMatches = (
        mockedFunction: sinon.SinonSpy,
        regex: RegExp
      ): boolean => {
        return mockedFunction.getCalls().some(call => {
          return call.args.some(callArgs => regex.test(callArgs.toString()));
        });
      };

      it('prints detected resources and debug messages to the logger', async () => {
        const sdk = new NodeSDK({
          autoDetectResources: true,
        });

        // This test depends on the env detector to be functioning as intended
        const mockedLoggerMethod = Sinon.fake();
        const mockedVerboseLoggerMethod = Sinon.fake();
        diag.setLogger(
          {
            debug: mockedLoggerMethod,
            verbose: mockedVerboseLoggerMethod,
          } as any,
          DiagLogLevel.VERBOSE
        );

        await sdk.detectResources();

        // Test for AWS and GCP Detector failure
        assert.ok(
          callArgsContains(
            mockedLoggerMethod,
            'GcpDetector failed: GCP Metadata unavailable.'
          )
        );
        assert.ok(
          callArgsContains(
            mockedLoggerMethod,
            'AwsEc2Detector failed: Nock: Disallowed net connect for "169.254.169.254:80/latest/api/token"'
          )
        );
        // Test that the Env Detector successfully found its resource and populated it with the right values.
        assert.ok(
          callArgsContains(mockedLoggerMethod, 'EnvDetector found resource.')
        );
        // Regex formatting accounts for whitespace variations in util.inspect output over different node versions
        assert.ok(
          callArgsMatches(
            mockedVerboseLoggerMethod,
            /{\s+'service\.instance\.id':\s+'627cc493',\s+'service\.name':\s+'my-service',\s+'service\.namespace':\s+'default',\s+'service\.version':\s+'0\.0\.1'\s+}\s*/
          )
        );
      });

      describe('with a faulty environment variable', () => {
        beforeEach(() => {
          process.env.OTEL_RESOURCE_ATTRIBUTES = 'bad=~attribute';
        });

        it('prints correct error messages when EnvDetector has an invalid variable', async () => {
          const sdk = new NodeSDK({
            autoDetectResources: true,
          });
          const mockedLoggerMethod = Sinon.fake();
          diag.setLogger(
            {
              debug: mockedLoggerMethod,
            } as any,
            DiagLogLevel.DEBUG
          );

          await sdk.detectResources();

          assert.ok(
            callArgsContains(
              mockedLoggerMethod,
              'EnvDetector failed: Attribute value should be a ASCII string with a length not exceed 255 characters.'
            )
          );
        });
      });
    });
  });
});
