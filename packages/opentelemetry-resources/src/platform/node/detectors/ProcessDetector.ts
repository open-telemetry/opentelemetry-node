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
import { ResourceAttributes as SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { Detector, Resource, ResourceDetectionConfig } from '../../../';
import { ResourceAttributes } from '../../../types';

/**
 * ProcessDetector will be used to detect the resources related current process running
 * and being instrumented from the NodeJS Process module.
 */
class ProcessDetector implements Detector {
  async detect(config?: ResourceDetectionConfig): Promise<Resource> {
    const processResource: ResourceAttributes = {
      [SemanticResourceAttributes.PROCESS_PID]: process.pid,
      [SemanticResourceAttributes.PROCESS_EXECUTABLE_NAME]: process.title || '',
      [SemanticResourceAttributes.PROCESS_COMMAND]: process.argv[1] || '',
      [SemanticResourceAttributes.PROCESS_COMMAND_LINE]:
        process.argv.join(' ') || '',
    };
    return this._getResourceAttributes(processResource, config);
  }
  /**
   * Validates process resource attribute map from process varaibls
   *
   * @param processResource The unsantized resource attributes from process as key/value pairs.
   * @param config: Config
   * @returns The sanitized resource attributes.
   */
  private _getResourceAttributes(
    processResource: ResourceAttributes,
    _config?: ResourceDetectionConfig
  ) {
    if (
      processResource[SemanticResourceAttributes.PROCESS_EXECUTABLE_NAME] ===
        '' ||
      processResource[SemanticResourceAttributes.PROCESS_EXECUTABLE_PATH] ===
        '' ||
      processResource[SemanticResourceAttributes.PROCESS_COMMAND] === '' ||
      processResource[SemanticResourceAttributes.PROCESS_COMMAND_LINE] === ''
    ) {
      diag.debug(
        'ProcessDetector failed: Unable to find required process resources. '
      );
      return Resource.empty();
    } else {
      return new Resource({
        ...processResource,
      });
    }
  }
}

export const processDetector = new ProcessDetector();
