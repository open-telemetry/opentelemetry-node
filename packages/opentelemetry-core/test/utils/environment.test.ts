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

import { getEnv } from '../../src/platform';
import {
  DEFAULT_ENVIRONMENT,
  ENVIRONMENT,
  ENVIRONMENT_MAP,
} from '../../src/utils/environment';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { LogLevel } from '../../src';

let lastMock: ENVIRONMENT_MAP = {};

/**
 * Mocks environment used for tests.
 */
export function mockEnvironment(values: ENVIRONMENT_MAP) {
  lastMock = values;
  if (typeof process !== 'undefined') {
    Object.keys(values).forEach(key => {
      process.env[key] = String(values[key]);
    });
  } else {
    Object.keys(values).forEach(key => {
      ((window as unknown) as ENVIRONMENT_MAP)[key] = String(values[key]);
    });
  }
}

/**
 * Removes mocked environment used for tests.
 */
export function removeMockEnvironment() {
  if (typeof process !== 'undefined') {
    Object.keys(lastMock).forEach(key => {
      delete process.env[key];
    });
  } else {
    Object.keys(lastMock).forEach(key => {
      delete ((window as unknown) as ENVIRONMENT_MAP)[key];
    });
  }
  lastMock = {};
}

describe('environment', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    removeMockEnvironment();
    sandbox.restore();
  });

  describe('parseEnvironment', () => {
    it('should parse environment variables', () => {
      mockEnvironment({
        FOO: '1',
        OTEL_NO_PATCH_MODULES: 'a,b,c',
        OTEL_LOG_LEVEL: 'ERROR',
        OTEL_SAMPLING_PROBABILITY: '0.5',
        OTEL_SPAN_ATTRIBUTE_VALUE_SIZE_LIMIT: '32',
      });
      const env = getEnv();
      assert.strictEqual(env.OTEL_NO_PATCH_MODULES, 'a,b,c');
      assert.strictEqual(env.OTEL_LOG_LEVEL, LogLevel.ERROR);
      assert.strictEqual(env.OTEL_SAMPLING_PROBABILITY, 0.5);
      assert.strictEqual(env.OTEL_SPAN_ATTRIBUTE_VALUE_SIZE_LIMIT, 32);
    });

    it('should parse OTEL_LOG_LEVEL despite casing', () => {
      mockEnvironment({
        OTEL_LOG_LEVEL: 'waRn',
      });
      const env = getEnv();
      assert.strictEqual(env.OTEL_LOG_LEVEL, LogLevel.WARN);
    });

    it('should parse environment variables and use defaults', () => {
      const env = getEnv();
      Object.keys(DEFAULT_ENVIRONMENT).forEach(envKey => {
        const key = envKey as keyof ENVIRONMENT;
        assert.strictEqual(
          env[key as keyof ENVIRONMENT],
          DEFAULT_ENVIRONMENT[key],
          `Variable '${key}' doesn't match`
        );
      });
    });
  });

  describe('mockEnvironment', () => {
    it('should remove a mock environment', () => {
      mockEnvironment({
        OTEL_LOG_LEVEL: 'DEBUG',
        OTEL_SAMPLING_PROBABILITY: 0.5,
      });
      removeMockEnvironment();
      const env = getEnv();
      assert.strictEqual(env.OTEL_LOG_LEVEL, LogLevel.INFO);
      assert.strictEqual(env.OTEL_SAMPLING_PROBABILITY, 1);
    });
  });
});
