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
  Detector,
  Resource,
  ResourceDetectionConfig,
} from '@opentelemetry/resources';
import {
  CloudProviderValues,
  ResourceAttributes,
} from '@opentelemetry/semantic-conventions';

/**
 * The AwsLambdaDetector can be used to detect if a process is running in AWS Lambda
 * and return a {@link Resource} populated with data about the environment.
 * Returns an empty Resource if detection fails.
 */
export class AwsLambdaDetector implements Detector {
  async detect(_config?: ResourceDetectionConfig): Promise<Resource> {
    const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
    if (!functionName) {
      return Resource.empty();
    }

    const functionVersion = process.env.AWS_LAMBDA_FUNCTION_VERSION;
    const region = process.env.AWS_REGION;

    const attributes = {
      [ResourceAttributes.CLOUD_PROVIDER]: String(CloudProviderValues.AWS),
    };
    if (region) {
      attributes[ResourceAttributes.CLOUD_REGION] = region;
    }

    if (functionName) {
      attributes[ResourceAttributes.FAAS_NAME] = functionName;
    }
    if (functionVersion) {
      attributes[ResourceAttributes.FAAS_VERSION] = functionVersion;
    }

    return new Resource(attributes);
  }
}

export const awsLambdaDetector = new AwsLambdaDetector();
