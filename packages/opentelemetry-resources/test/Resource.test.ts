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
import { SDK_INFO } from '@opentelemetry/core';
import { Resource } from '../src';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

describe('Resource', () => {
  const resource1 = new Resource({
    'k8s.io/container/name': 'c1',
    'k8s.io/namespace/name': 'default',
    'k8s.io/pod/name': 'pod-xyz-123',
  });
  const resource2 = new Resource({
    'k8s.io/zone': 'zone1',
    'k8s.io/location': 'location',
  });
  const resource3 = new Resource({
    'k8s.io/container/name': 'c2',
    'k8s.io/location': 'location1',
  });
  const emptyResource = new Resource({});

  it('should return merged resource', () => {
    const expectedResource = new Resource({
      'k8s.io/container/name': 'c1',
      'k8s.io/namespace/name': 'default',
      'k8s.io/pod/name': 'pod-xyz-123',
      'k8s.io/zone': 'zone1',
      'k8s.io/location': 'location',
    });
    const actualResource = resource1.merge(resource2);
    assert.strictEqual(Object.keys(actualResource.attributes).length, 5);
    assert.deepStrictEqual(actualResource, expectedResource);
  });

  it('should return merged resource when collision in attributes', () => {
    const expectedResource = new Resource({
      'k8s.io/container/name': 'c2',
      'k8s.io/namespace/name': 'default',
      'k8s.io/pod/name': 'pod-xyz-123',
      'k8s.io/location': 'location1',
    });
    const actualResource = resource1.merge(resource3);
    assert.strictEqual(Object.keys(actualResource.attributes).length, 4);
    assert.deepStrictEqual(actualResource, expectedResource);
  });

  it('should return merged resource when first resource is empty', () => {
    const actualResource = emptyResource.merge(resource2);
    assert.strictEqual(Object.keys(actualResource.attributes).length, 2);
    assert.deepStrictEqual(actualResource, resource2);
  });

  it('should return merged resource when other resource is empty', () => {
    const actualResource = resource1.merge(emptyResource);
    assert.strictEqual(Object.keys(actualResource.attributes).length, 3);
    assert.deepStrictEqual(actualResource, resource1);
  });

  it('should return merged resource when other resource is null', () => {
    const actualResource = resource1.merge(null);
    assert.strictEqual(Object.keys(actualResource.attributes).length, 3);
    assert.deepStrictEqual(actualResource, resource1);
  });

  it('should accept string, number, and boolean values', () => {
    const resource = new Resource({
      'custom.string': 'strvalue',
      'custom.number': 42,
      'custom.boolean': true,
    });
    assert.strictEqual(resource.attributes['custom.string'], 'strvalue');
    assert.strictEqual(resource.attributes['custom.number'], 42);
    assert.strictEqual(resource.attributes['custom.boolean'], true);
  });

  describe('.empty()', () => {
    it('should return an empty resource (except required service name)', () => {
      const resource = Resource.empty();
      assert.deepStrictEqual(Object.keys(resource.attributes), []);
    });

    it('should return the same empty resource', () => {
      assert.strictEqual(Resource.empty(), Resource.empty());
    });
  });

  describe('.default()', () => {
    it('should return a default resource', () => {
      const resource = Resource.default();
      assert.strictEqual(resource.attributes[SemanticResourceAttributes.TELEMETRY_SDK_NAME], SDK_INFO[SemanticResourceAttributes.TELEMETRY_SDK_NAME]);
      assert.strictEqual(resource.attributes[SemanticResourceAttributes.TELEMETRY_SDK_LANGUAGE], SDK_INFO[SemanticResourceAttributes.TELEMETRY_SDK_LANGUAGE]);
      assert.strictEqual(resource.attributes[SemanticResourceAttributes.TELEMETRY_SDK_VERSION], SDK_INFO[SemanticResourceAttributes.TELEMETRY_SDK_VERSION]);
      assert.strictEqual(resource.attributes[SemanticResourceAttributes.SERVICE_NAME], `unknown_service:${process.argv0}`);
    });
  });
});
