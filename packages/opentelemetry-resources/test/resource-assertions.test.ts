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

import { SDK_INFO } from '@opentelemetry/core';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { Resource } from '../src/Resource';
import {
  assertCloudResource,
  assertContainerResource,
  assertHostResource,
  assertK8sResource,
  assertTelemetrySDKResource,
  assertServiceResource,
} from './util/resource-assertions';

describe('assertCloudResource', () => {
  it('requires one cloud label', () => {
    const resource = new Resource({
      [SemanticResourceAttributes.CLOUD_PROVIDER]: 'gcp',
    });
    assertCloudResource(resource, {});
  });

  it('validates optional attributes', () => {
    const resource = new Resource({
      [SemanticResourceAttributes.CLOUD_PROVIDER]: 'gcp',
      [SemanticResourceAttributes.CLOUD_ACCOUNT_ID]: 'opentelemetry',
      [SemanticResourceAttributes.CLOUD_REGION]: 'us-central1',
      [SemanticResourceAttributes.CLOUD_AVAILABILITY_ZONE]: 'us-central1-a',
    });
    assertCloudResource(resource, {
      provider: 'gcp',
      accountId: 'opentelemetry',
      region: 'us-central1',
      zone: 'us-central1-a',
    });
  });
});

describe('assertContainerResource', () => {
  it('requires one container label', () => {
    const resource = new Resource({
      [SemanticResourceAttributes.CONTAINER_NAME]: 'opentelemetry-autoconf',
    });
    assertContainerResource(resource, {});
  });

  it('validates optional attributes', () => {
    const resource = new Resource({
      [SemanticResourceAttributes.CONTAINER_NAME]: 'opentelemetry-autoconf',
      [SemanticResourceAttributes.CONTAINER_ID]: 'abc',
      [SemanticResourceAttributes.CONTAINER_IMAGE_NAME]:
        'gcr.io/opentelemetry/operator',
      [SemanticResourceAttributes.CONTAINER_IMAGE_TAG]: '0.1',
    });
    assertContainerResource(resource, {
      name: 'opentelemetry-autoconf',
      id: 'abc',
      imageName: 'gcr.io/opentelemetry/operator',
      imageTag: '0.1',
    });
  });
});

describe('assertHostResource', () => {
  it('requires one host label', () => {
    const resource = new Resource({
      [SemanticResourceAttributes.HOST_ID]: 'opentelemetry-test-id',
    });
    assertHostResource(resource, {});
  });

  it('validates optional attributes', () => {
    const resource = new Resource({
      [SemanticResourceAttributes.HOST_ID]: 'opentelemetry-test-id',
      [SemanticResourceAttributes.HOST_NAME]: 'opentelemetry-test-name',
      [SemanticResourceAttributes.HOST_TYPE]: 'n1-standard-1',
      [SemanticResourceAttributes.HOST_IMAGE_NAME]:
        'infra-ami-eks-worker-node-7d4ec78312, CentOS-8-x86_64-1905',
      [SemanticResourceAttributes.HOST_IMAGE_ID]: 'ami-07b06b442921831e5',
      [SemanticResourceAttributes.HOST_IMAGE_VERSION]: '0.1',
    });
    assertHostResource(resource, {
      hostName: 'opentelemetry-test-hostname',
      id: 'opentelemetry-test-id',
      name: 'opentelemetry-test-name',
      hostType: 'n1-standard-1',
      imageName: 'infra-ami-eks-worker-node-7d4ec78312, CentOS-8-x86_64-1905',
      imageId: 'ami-07b06b442921831e5',
      imageVersion: '0.1',
    });
  });
});

describe('assertK8sResource', () => {
  it('requires one k8s label', () => {
    const resource = new Resource({
      [SemanticResourceAttributes.K8S_CLUSTER_NAME]: 'opentelemetry-cluster',
    });
    assertK8sResource(resource, {});
  });

  it('validates optional attributes', () => {
    const resource = new Resource({
      [SemanticResourceAttributes.K8S_CLUSTER_NAME]: 'opentelemetry-cluster',
      [SemanticResourceAttributes.K8S_NAMESPACE_NAME]: 'default',
      [SemanticResourceAttributes.K8S_POD_NAME]: 'opentelemetry-pod-autoconf',
      [SemanticResourceAttributes.K8S_DEPLOYMENT_NAME]: 'opentelemetry',
    });
    assertK8sResource(resource, {
      clusterName: 'opentelemetry-cluster',
      namespaceName: 'default',
      podName: 'opentelemetry-pod-autoconf',
      deploymentName: 'opentelemetry',
    });
  });
});

describe('assertTelemetrySDKResource', () => {
  it('uses default validations', () => {
    const resource = new Resource({
      [SemanticResourceAttributes.TELEMETRY_SDK_NAME]: SDK_INFO.NAME,
      [SemanticResourceAttributes.TELEMETRY_SDK_LANGUAGE]: SDK_INFO.LANGUAGE,
      [SemanticResourceAttributes.TELEMETRY_SDK_VERSION]: SDK_INFO.VERSION,
    });
    assertTelemetrySDKResource(resource, {});
  });

  it('validates optional attributes', () => {
    const resource = new Resource({
      [SemanticResourceAttributes.TELEMETRY_SDK_NAME]: 'opentelemetry',
      [SemanticResourceAttributes.TELEMETRY_SDK_LANGUAGE]: 'nodejs',
      [SemanticResourceAttributes.TELEMETRY_SDK_VERSION]: '0.1.0',
    });
    assertTelemetrySDKResource(resource, {
      name: 'opentelemetry',
      language: 'nodejs',
      version: '0.1.0',
    });
  });
});

describe('assertServiceResource', () => {
  it('validates required attributes', () => {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'shoppingcart',
      [SemanticResourceAttributes.SERVICE_INSTANCE_ID]:
        '627cc493-f310-47de-96bd-71410b7dec09',
    });
    assertServiceResource(resource, {
      name: 'shoppingcart',
      instanceId: '627cc493-f310-47de-96bd-71410b7dec09',
    });
  });

  it('validates optional attributes', () => {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'shoppingcart',
      [SemanticResourceAttributes.SERVICE_INSTANCE_ID]:
        '627cc493-f310-47de-96bd-71410b7dec09',
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'shop',
      [SemanticResourceAttributes.SERVICE_VERSION]: '0.1.0',
    });
    assertServiceResource(resource, {
      name: 'shoppingcart',
      instanceId: '627cc493-f310-47de-96bd-71410b7dec09',
      namespace: 'shop',
      version: '0.1.0',
    });
  });
});
