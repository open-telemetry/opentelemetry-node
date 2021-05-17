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
  SpanAttributes,
  Context,
  getSpanContext,
  isSpanContextValid,
  Link,
  Sampler,
  SamplingResult,
  SpanKind,
  TraceFlags,
} from '@opentelemetry/api';
import { globalErrorHandler } from '../../common/global-error-handler';
import { AlwaysOffSampler } from './AlwaysOffSampler';
import { AlwaysOnSampler } from './AlwaysOnSampler';

/**
 * A composite sampler that either respects the parent span's sampling decision
 * or delegates to `delegateSampler` for root spans.
 */
export class ParentBasedSampler implements Sampler {
  private _root: Sampler;
  private _remoteParentSampled: Sampler;
  private _remoteParentNotSampled: Sampler;
  private _localParentSampled: Sampler;
  private _localParentNotSampled: Sampler;

  constructor(config: ParentBasedSamplerConfig) {
    this._root = config.root;

    if (!this._root) {
      globalErrorHandler(
        new Error('ParentBasedSampler must have a root sampler configured')
      );
      this._root = new AlwaysOnSampler();
    }

    this._remoteParentSampled =
      config.remoteParentSampled ?? new AlwaysOnSampler();
    this._remoteParentNotSampled =
      config.remoteParentNotSampled ?? new AlwaysOffSampler();
    this._localParentSampled =
      config.localParentSampled ?? new AlwaysOnSampler();
    this._localParentNotSampled =
      config.localParentNotSampled ?? new AlwaysOffSampler();
  }

  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: SpanAttributes,
    links: Link[]
  ): SamplingResult {
    const parentContext = getSpanContext(context);

    if (!parentContext || !isSpanContextValid(parentContext)) {
      return this._root.shouldSample(
        context,
        traceId,
        spanName,
        spanKind,
        attributes,
        links
      );
    }

    if (parentContext.isRemote) {
      if (parentContext.traceFlags & TraceFlags.SAMPLED) {
        return this._remoteParentSampled.shouldSample(
          context,
          traceId,
          spanName,
          spanKind,
          attributes,
          links
        );
      }
      return this._remoteParentNotSampled.shouldSample(
        context,
        traceId,
        spanName,
        spanKind,
        attributes,
        links
      );
    }

    if (parentContext.traceFlags & TraceFlags.SAMPLED) {
      return this._localParentSampled.shouldSample(
        context,
        traceId,
        spanName,
        spanKind,
        attributes,
        links
      );
    }

    return this._localParentNotSampled.shouldSample(
      context,
      traceId,
      spanName,
      spanKind,
      attributes,
      links
    );
  }

  toString(): string {
    return `ParentBased{root=${this._root.toString()}, remoteParentSampled=${this._remoteParentSampled.toString()}, remoteParentNotSampled=${this._remoteParentNotSampled.toString()}, localParentSampled=${this._localParentSampled.toString()}, localParentNotSampled=${this._localParentNotSampled.toString()}}`;
  }
}

interface ParentBasedSamplerConfig {
  /** Sampler called for spans with no parent */
  root: Sampler;
  /** Sampler called for spans with a remote parent which was sampled. Default AlwaysOn */
  remoteParentSampled?: Sampler;
  /** Sampler called for spans with a remote parent which was not sampled. Default AlwaysOff */
  remoteParentNotSampled?: Sampler;
  /** Sampler called for spans with a local parent which was sampled. Default AlwaysOn */
  localParentSampled?: Sampler;
  /** Sampler called for spans with a local parent which was not sampled. Default AlwaysOff */
  localParentNotSampled?: Sampler;
}
