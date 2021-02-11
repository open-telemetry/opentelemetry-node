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

// This is copy from previous version, should be removed after plugins are gone

import { OptionalDiagLogger, diag } from '@opentelemetry/api';
import * as path from 'path';
import * as semver from 'semver';

/**
 * Gets the package version.
 * @param diagLogger An optional diagnostic logger to use.
 * @param basedir The base directory.
 */
export function getPackageVersion(
  diagLogger: OptionalDiagLogger,
  basedir: string
): string | null {
  const theLogger = diagLogger || diag;
  const pjsonPath = path.join(basedir, 'package.json');
  try {
    const version = require(pjsonPath).version;
    // Attempt to parse a string as a semantic version, returning either a
    // SemVer object or null.
    if (!semver.parse(version)) {
      theLogger.error(
        `getPackageVersion: [${pjsonPath}|${version}] Version string could not be parsed.`
      );
      return null;
    }
    return version;
  } catch (e) {
    theLogger.error(
      `getPackageVersion: [${pjsonPath}] An error occurred while retrieving version string. ${e.message}`
    );
    return null;
  }
}

/**
 * Determines if a version is supported
 * @param moduleVersion a version in [semver](https://semver.org/spec/v2.0.0.html) format.
 * @param [supportedVersions] a list of supported versions ([semver](https://semver.org/spec/v2.0.0.html) format).
 */
export function isSupportedVersion(
  moduleVersion: string,
  supportedVersions?: string[]
) {
  if (!Array.isArray(supportedVersions) || supportedVersions.length === 0) {
    return true;
  }

  return supportedVersions.some(supportedVersion =>
    semver.satisfies(moduleVersion, supportedVersion)
  );
}

/**
 * Adds a search path for plugin modules. Intended for testing purposes only.
 * @param searchPath The path to add.
 */
export function searchPathForTest(searchPath: string) {
  module.paths.push(searchPath);
}
