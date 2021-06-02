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

import { Resource } from '../../Resource';
import { ResourceDetectionConfig } from '../../config';
import { diag } from '@opentelemetry/api';
import * as util from 'util';

/**
 * Runs all resource detectors and returns the results merged into a single
 * Resource.
 *
 * @param config Configuration for resource detection
 */
export const detectResources = async (
  config: ResourceDetectionConfig = {}
): Promise<Resource> => {
  const internalConfig: ResourceDetectionConfig = Object.assign(config);

  const resources: Array<Resource> = await Promise.all(
    (internalConfig.detectors || []).map(async d => {
      try {
        const resource = await d.detect(internalConfig);
        diag.debug(`${d.constructor.name} found resource.`, resource);
        return resource;
      } catch (e) {
        diag.debug(`${d.constructor.name} failed: ${e.message}`);
        return Resource.empty();
      }
    })
  );

  // Future check if verbose logging is enabled issue #1903
  logResources(resources);

  return resources.reduce(
    (acc, resource) => acc.merge(resource),
    Resource.empty()
  );
};

/**
 * Writes debug information about the detected resources to the logger defined in the resource detection config, if one is provided.
 *
 * @param resources The array of {@link Resource} that should be logged. Empty entried will be ignored.
 */
const logResources = (resources: Array<Resource>) => {
  resources.forEach(resource => {
    // Print only populated resources
    if (Object.keys(resource.attributes).length > 0) {
      const resourceDebugString = util.inspect(resource.attributes, {
        depth: 2,
        breakLength: Infinity,
        sorted: true,
        compact: false,
      });
      diag.verbose(resourceDebugString);
    }
  });
};
