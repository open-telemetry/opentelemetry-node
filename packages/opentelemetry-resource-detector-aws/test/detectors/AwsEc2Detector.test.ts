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

import * as nock from 'nock';
import * as assert from 'assert';
import { Resource } from '@opentelemetry/resources';
import { awsEc2Detector } from '../../src';
import {
  assertCloudResource,
  assertHostResource,
} from '@opentelemetry/resources/test/util/resource-assertions';

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

describe('awsEc2Detector', () => {
  beforeEach(() => {
    nock.disableNetConnect();
    nock.cleanAll();
  });

  afterEach(() => {
    nock.enableNetConnect();
  });

  describe('with successful request', () => {
    it('should return aws_ec2_instance resource', async () => {
      const scope = nock(AWS_HOST)
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

      const resource: Resource = await awsEc2Detector.detect();

      scope.done();

      assert.ok(resource);

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
    });
  });

  describe('with unsuccessful request', () => {
    it('should throw when receiving error response code', async () => {
      const expectedError = new Error('Failed to load page, status code: 404');
      const scope = nock(AWS_HOST)
        .persist()
        .put(AWS_TOKEN_PATH)
        .matchHeader(AWS_METADATA_TTL_HEADER, '60')
        .reply(200, () => mockedTokenResponse)
        .get(AWS_IDENTITY_PATH)
        .matchHeader(AWS_METADATA_TOKEN_HEADER, mockedTokenResponse)
        .reply(200, () => mockedIdentityResponse)
        .get(AWS_HOST_PATH)
        .matchHeader(AWS_METADATA_TOKEN_HEADER, mockedTokenResponse)
        .reply(404, () => new Error());

      try {
        await awsEc2Detector.detect();
        assert.ok(false, 'Expected to throw');
      } catch (err) {
        assert.deepStrictEqual(err, expectedError);
      }

      scope.done();
    });

    it('should throw when timed out', async () => {
      const expectedError = new Error('EC2 metadata api request timed out.');
      const scope = nock(AWS_HOST)
        .put(AWS_TOKEN_PATH)
        .matchHeader(AWS_METADATA_TTL_HEADER, '60')
        .reply(200, () => mockedTokenResponse)
        .get(AWS_IDENTITY_PATH)
        .matchHeader(AWS_METADATA_TOKEN_HEADER, mockedTokenResponse)
        .reply(200, () => mockedIdentityResponse)
        .get(AWS_HOST_PATH)
        .matchHeader(AWS_METADATA_TOKEN_HEADER, mockedTokenResponse)
        .delayConnection(2000)
        .reply(200, () => mockedHostResponse);

      try {
        await awsEc2Detector.detect();
        assert.ok(false, 'Expected to throw');
      } catch (err) {
        assert.deepStrictEqual(err, expectedError);
      }

      scope.done();
    });

    it('should throw when replied with an Error', async () => {
      const expectedError = new Error('NOT FOUND');
      const scope = nock(AWS_HOST)
        .put(AWS_TOKEN_PATH)
        .matchHeader(AWS_METADATA_TTL_HEADER, '60')
        .reply(200, () => mockedTokenResponse)
        .get(AWS_IDENTITY_PATH)
        .matchHeader(AWS_METADATA_TOKEN_HEADER, mockedTokenResponse)
        .replyWithError(expectedError.message);

      try {
        await awsEc2Detector.detect();
        assert.ok(false, 'Expected to throw');
      } catch (err) {
        assert.deepStrictEqual(err, expectedError);
      }

      scope.done();
    });
  });
});
