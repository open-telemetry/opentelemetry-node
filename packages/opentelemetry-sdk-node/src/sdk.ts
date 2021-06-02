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

import { TextMapPropagator } from '@opentelemetry/api';
import { metrics } from '@opentelemetry/api-metrics';
import { ContextManager } from '@opentelemetry/api';
import { MeterConfig, MeterProvider } from '@opentelemetry/metrics';
import {
  InstrumentationOption,
  registerInstrumentations,
} from '@opentelemetry/instrumentation';
import { NodeTracerConfig, NodeTracerProvider } from '@opentelemetry/node';
import { awsEc2Detector } from '@opentelemetry/resource-detector-aws';
import { gcpDetector } from '@opentelemetry/resource-detector-gcp';
import {
  detectResources,
  envDetector,
  processDetector,
  Resource,
  ResourceDetectionConfig,
} from '@opentelemetry/resources';
import { BatchSpanProcessor, SpanProcessor } from '@opentelemetry/tracing';
import { NodeSDKConfiguration } from './types';

/** This class represents everything needed to register a fully configured OpenTelemetry Node.js SDK */
export class NodeSDK {
  private _tracerProviderConfig?: {
    tracerConfig: NodeTracerConfig;
    spanProcessor: SpanProcessor;
    contextManager?: ContextManager;
    textMapPropagator?: TextMapPropagator;
  };
  private _instrumentations: InstrumentationOption[];
  private _meterProviderConfig?: MeterConfig;

  private _resource: Resource;

  private _autoDetectResources: boolean;

  private _tracerProvider?: NodeTracerProvider;
  private _meterProvider?: MeterProvider;

  /**
   * Create a new NodeJS SDK instance
   */
  public constructor(configuration: Partial<NodeSDKConfiguration> = {}) {
    this._resource = configuration.resource ?? new Resource({});

    this._autoDetectResources = configuration.autoDetectResources ?? true;

    if (configuration.spanProcessor || configuration.traceExporter) {
      const tracerProviderConfig: NodeTracerConfig = {};

      if (configuration.sampler) {
        tracerProviderConfig.sampler = configuration.sampler;
      }
      if (configuration.spanLimits) {
        tracerProviderConfig.spanLimits = configuration.spanLimits;
      }

      const spanProcessor =
        configuration.spanProcessor ??
        new BatchSpanProcessor(configuration.traceExporter!);

      this.configureTracerProvider(
        tracerProviderConfig,
        spanProcessor,
        configuration.contextManager,
        configuration.textMapPropagator
      );
    }

    if (configuration.metricExporter) {
      const meterConfig: MeterConfig = {};

      if (configuration.metricProcessor) {
        meterConfig.processor = configuration.metricProcessor;
      }
      if (configuration.metricExporter) {
        meterConfig.exporter = configuration.metricExporter;
      }
      if (typeof configuration.metricInterval === 'number') {
        meterConfig.interval = configuration.metricInterval;
      }

      this.configureMeterProvider(meterConfig);
    }

    let instrumentations: InstrumentationOption[] = [];
    if (configuration.instrumentations) {
      instrumentations = configuration.instrumentations;
    }
    this._instrumentations = instrumentations;
  }
  /** Set configurations required to register a NodeTracerProvider */
  public configureTracerProvider(
    tracerConfig: NodeTracerConfig,
    spanProcessor: SpanProcessor,
    contextManager?: ContextManager,
    textMapPropagator?: TextMapPropagator
  ) {
    this._tracerProviderConfig = {
      tracerConfig,
      spanProcessor,
      contextManager,
      textMapPropagator,
    };
  }

  /** Set configurations needed to register a MeterProvider */
  public configureMeterProvider(config: MeterConfig) {
    this._meterProviderConfig = config;
  }

  /** Detect resource attributes */
  public async detectResources(config?: ResourceDetectionConfig) {
    const internalConfig: ResourceDetectionConfig = {
      detectors: [awsEc2Detector, gcpDetector, envDetector, processDetector],
      ...config,
    };

    this.addResource(await detectResources(internalConfig));
  }

  /** Manually add a resource */
  public addResource(resource: Resource) {
    this._resource = this._resource.merge(resource);
  }

  /**
   * Once the SDK has been configured, call this method to construct SDK components and register them with the OpenTelemetry API.
   */
  public async start() {
    if (this._autoDetectResources) {
      await this.detectResources();
    }

    if (this._tracerProviderConfig) {
      const tracerProvider = new NodeTracerProvider({
        ...this._tracerProviderConfig.tracerConfig,
        resource: this._resource,
      });

      this._tracerProvider = tracerProvider;

      tracerProvider.addSpanProcessor(this._tracerProviderConfig.spanProcessor);
      tracerProvider.register({
        contextManager: this._tracerProviderConfig.contextManager,
        propagator: this._tracerProviderConfig.textMapPropagator,
      });
    }

    if (this._meterProviderConfig) {
      const meterProvider = new MeterProvider({
        ...this._meterProviderConfig,
        resource: this._resource,
      });

      this._meterProvider = meterProvider;

      metrics.setGlobalMeterProvider(meterProvider);
    }

    registerInstrumentations({
      instrumentations: this._instrumentations,
    });
  }

  public shutdown(): Promise<void> {
    const promises: Promise<unknown>[] = [];
    if (this._tracerProvider) {
      promises.push(this._tracerProvider.shutdown());
    }
    if (this._meterProvider) {
      promises.push(this._meterProvider.shutdown());
    }

    return (
      Promise.all(promises)
        // return void instead of the array from Promise.all
        .then(() => {})
    );
  }
}
