/*!
 * Copyright 2019, OpenTelemetry Authors
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

import { NodeTracer } from './NodeTracer';
import { NodeTracerConfig } from './config';
import {
  BasicTracer,
  AbstractBasicTracerFactory,
} from '@opentelemetry/tracing';

export class NodeTracerFactory extends AbstractBasicTracerFactory {
  private readonly _config?: NodeTracerConfig;

  constructor(config?: NodeTracerConfig) {
    super();
    this._config = config;
  }

  protected _newTracer(): BasicTracer {
    return new NodeTracer(this._config);
  }
}
