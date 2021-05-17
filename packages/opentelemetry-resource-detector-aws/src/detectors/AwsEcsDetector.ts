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
import {
  Detector,
  Resource,
  ResourceDetectionConfig,
} from '@opentelemetry/resources';
import {
  CloudProviderValues,
  CloudPlatformValues,
  ResourceAttributes,
} from '@opentelemetry/semantic-conventions';
import * as util from 'util';
import * as fs from 'fs';
import * as os from 'os';
import { getEnv } from '@opentelemetry/core';

/**
 * The AwsEcsDetector can be used to detect if a process is running in AWS
 * ECS and return a {@link Resource} populated with data about the ECS
 * plugins of AWS X-Ray. Returns an empty Resource if detection fails.
 */
export class AwsEcsDetector implements Detector {
  readonly CONTAINER_ID_LENGTH = 64;
  readonly DEFAULT_CGROUP_PATH = '/proc/self/cgroup';
  private static readFileAsync = util.promisify(fs.readFile);

  async detect(_config?: ResourceDetectionConfig): Promise<Resource> {
    const env = getEnv();
    if (!env.ECS_CONTAINER_METADATA_URI_V4 && !env.ECS_CONTAINER_METADATA_URI) {
      diag.debug('AwsEcsDetector failed: Process is not on ECS');
      return Resource.empty();
    }

    const hostName = os.hostname();
    const containerId = await this._getContainerId();

    return !hostName && !containerId
      ? Resource.empty()
      : new Resource({
          [ResourceAttributes.CLOUD_PROVIDER]: CloudProviderValues.AWS,
          [ResourceAttributes.CLOUD_PLATFORM]: CloudPlatformValues.AWS_ECS,
          [ResourceAttributes.CONTAINER_NAME]: hostName || '',
          [ResourceAttributes.CONTAINER_ID]: containerId || '',
        });
  }

  /**
   * Read container ID from cgroup file
   * In ECS, even if we fail to find target file
   * or target file does not contain container ID
   * we do not throw an error but throw warning message
   * and then return null string
   */
  private async _getContainerId(): Promise<string | undefined> {
    try {
      const rawData = await AwsEcsDetector.readFileAsync(
        this.DEFAULT_CGROUP_PATH,
        'utf8'
      );
      const splitData = rawData.trim().split('\n');
      for (const str of splitData) {
        if (str.length > this.CONTAINER_ID_LENGTH) {
          return str.substring(str.length - this.CONTAINER_ID_LENGTH);
        }
      }
    } catch (e) {
      diag.warn(`AwsEcsDetector failed to read container ID: ${e.message}`);
    }
    return undefined;
  }
}

export const awsEcsDetector = new AwsEcsDetector();
