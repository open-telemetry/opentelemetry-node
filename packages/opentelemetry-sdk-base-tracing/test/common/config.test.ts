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
  AlwaysOffSampler,
  AlwaysOnSampler,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/core';
import * as assert from 'assert';
import { buildSamplerFromEnv } from '../../src/config';

describe('config', () => {
  const envSource = (typeof window !== 'undefined'
    ? window
    : process.env) as any;

  describe('buildSamplerFromEnv()', () => {
    afterEach(() => {
      delete envSource.OTEL_TRACES_SAMPLER;
      delete envSource.OTEL_TRACES_SAMPLER_ARG;
    });

    it('should handle always_on case', () => {
      envSource.OTEL_TRACES_SAMPLER = 'always_on';
      assert.ok(buildSamplerFromEnv() instanceof AlwaysOnSampler);
      assert.strictEqual(buildSamplerFromEnv().toString(), 'AlwaysOnSampler');
    });

    it('should handle always_off case', () => {
      envSource.OTEL_TRACES_SAMPLER = 'always_off';
      assert.ok(buildSamplerFromEnv() instanceof AlwaysOffSampler);
      assert.strictEqual(buildSamplerFromEnv().toString(), 'AlwaysOffSampler');
    });

    it('should handle traceidratio case', () => {
      envSource.OTEL_TRACES_SAMPLER = 'traceidratio';
      envSource.OTEL_TRACES_SAMPLER_ARG = '0.1';
      assert.ok(buildSamplerFromEnv() instanceof TraceIdRatioBasedSampler);
      assert.strictEqual(
        buildSamplerFromEnv().toString(),
        'TraceIdRatioBased{0.1}'
      );
    });

    it('should handle parentbased_always_on case', () => {
      envSource.OTEL_TRACES_SAMPLER = 'parentbased_always_on';
      assert.ok(buildSamplerFromEnv() instanceof ParentBasedSampler);
      assert.strictEqual(
        buildSamplerFromEnv().toString(),
        'ParentBased{root=AlwaysOnSampler, remoteParentSampled=AlwaysOnSampler, remoteParentNotSampled=AlwaysOffSampler, localParentSampled=AlwaysOnSampler, localParentNotSampled=AlwaysOffSampler}'
      );
    });

    it('should handle parentbased_always_off case', () => {
      envSource.OTEL_TRACES_SAMPLER = 'parentbased_always_off';
      assert.ok(buildSamplerFromEnv() instanceof ParentBasedSampler);
      assert.strictEqual(
        buildSamplerFromEnv().toString(),
        'ParentBased{root=AlwaysOffSampler, remoteParentSampled=AlwaysOnSampler, remoteParentNotSampled=AlwaysOffSampler, localParentSampled=AlwaysOnSampler, localParentNotSampled=AlwaysOffSampler}'
      );
    });

    it('should handle parentbased_traceidratio case', () => {
      envSource.OTEL_TRACES_SAMPLER = 'parentbased_traceidratio';
      envSource.OTEL_TRACES_SAMPLER_ARG = '0.2';
      assert.ok(buildSamplerFromEnv() instanceof ParentBasedSampler);
      assert.strictEqual(
        buildSamplerFromEnv().toString(),
        'ParentBased{root=TraceIdRatioBased{0.2}, remoteParentSampled=AlwaysOnSampler, remoteParentNotSampled=AlwaysOffSampler, localParentSampled=AlwaysOnSampler, localParentNotSampled=AlwaysOffSampler}'
      );
    });

    it('should handle default case with probability 1', () => {
      assert.ok(buildSamplerFromEnv() instanceof ParentBasedSampler);
      assert.strictEqual(
        buildSamplerFromEnv().toString(),
        'ParentBased{root=AlwaysOnSampler, remoteParentSampled=AlwaysOnSampler, remoteParentNotSampled=AlwaysOffSampler, localParentSampled=AlwaysOnSampler, localParentNotSampled=AlwaysOffSampler}'
      );
    });

    it('should handle default case with probability lower than 1', () => {
      assert.ok(buildSamplerFromEnv() instanceof ParentBasedSampler);
      assert.strictEqual(
        buildSamplerFromEnv().toString(),
        'ParentBased{root=AlwaysOnSampler, remoteParentSampled=AlwaysOnSampler, remoteParentNotSampled=AlwaysOffSampler, localParentSampled=AlwaysOnSampler, localParentNotSampled=AlwaysOffSampler}'
      );
    });
  });
});
