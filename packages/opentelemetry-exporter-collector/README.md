# OpenTelemetry Collector Exporter for web and node

[![NPM Published Version][npm-img]][npm-url]
[![dependencies][dependencies-image]][dependencies-url]
[![devDependencies][devDependencies-image]][devDependencies-url]
[![Apache License][license-image]][license-image]

This module provides exporter for web and node to be used with [opentelemetry-collector][opentelemetry-collector-url] - last tested with version **0.25.0**.

## Installation

```bash
npm install --save @opentelemetry/exporter-collector
```

## Traces in Web

The CollectorTraceExporter in Web expects the endpoint to end in `/v1/traces`.

```js
import { BatchSpanProcessor } from '@opentelemetry/tracing';
import { WebTracerProvider } from '@opentelemetry/web';
import { CollectorTraceExporter } from '@opentelemetry/exporter-collector';

const collectorOptions = {
  url: '<opentelemetry-collector-url>', // url is optional and can be omitted - default is http://localhost:55681/v1/trace
  headers: {}, // an optional object containing custom headers to be sent with each request
  concurrencyLimit: 10, // an optional limit on pending requests
};

const provider = new WebTracerProvider();
const exporter = new CollectorTraceExporter(collectorOptions);
provider.addSpanProcessor(new BatchSpanProcessor(exporter, {
  // The maximum queue size. After the size is reached spans are dropped.
  maxQueueSize: 100,
  // The maximum batch size of every export. It must be smaller or equal to maxQueueSize.
  maxExportBatchSize: 10,
  // The interval between two consecutive exports
  scheduledDelayMillis: 500,
  // How long the export can run before it is cancelled
  exportTimeoutMillis: 30000,
}));

provider.register();

```

## Metrics in Web

The CollectorMetricExporter in Web expects the endpoint to end in `/v1/metrics`.

```js
import { MeterProvider } from '@opentelemetry/metrics';
import { CollectorMetricExporter } from '@opentelemetry/exporter-collector';
const collectorOptions = {
  url: '<opentelemetry-collector-url>', // url is optional and can be omitted - default is http://localhost:55681/v1/metrics
  headers: {}, // an optional object containing custom headers to be sent with each request
  concurrencyLimit: 1, // an optional limit on pending requests
};
const exporter = new CollectorMetricExporter(collectorOptions);

// Register the exporter
const meter = new MeterProvider({
  exporter,
  interval: 60000,
}).getMeter('example-meter');

// Now, start recording data
const counter = meter.createCounter('metric_name');
counter.add(10, { 'key': 'value' });

```

## Traces in Node - JSON over http

```js
const { BasicTracerProvider, BatchSpanProcessor } = require('@opentelemetry/tracing');
const { CollectorTraceExporter } =  require('@opentelemetry/exporter-collector');

const collectorOptions = {
  serviceName: 'basic-service',
  url: '<opentelemetry-collector-url>', // url is optional and can be omitted - default is http://localhost:55681/v1/trace
  headers: {
    foo: 'bar'
  }, // an optional object containing custom headers to be sent with each request will only work with http
  concurrencyLimit: 10, // an optional limit on pending requests
};

const provider = new BasicTracerProvider();
const exporter = new CollectorTraceExporter(collectorOptions);
provider.addSpanProcessor(new BatchSpanProcessor(exporter, {
  // The maximum queue size. After the size is reached spans are dropped.
  maxQueueSize: 1000,
  // The interval between two consecutive exports
  scheduledDelayMillis: 30000,
}));

provider.register();

```

## Metrics in Node

```js
const { MeterProvider } = require('@opentelemetry/metrics');
const { CollectorMetricExporter } =  require('@opentelemetry/exporter-collector');
const collectorOptions = {
  serviceName: 'basic-service',
  url: '<opentelemetry-collector-url>', // url is optional and can be omitted - default is http://localhost:55681/v1/metrics
  concurrencyLimit: 1, // an optional limit on pending requests
};
const exporter = new CollectorMetricExporter(collectorOptions);

// Register the exporter
const meter = new MeterProvider({
  exporter,
  interval: 60000,
}).getMeter('example-meter');

// Now, start recording data
const counter = meter.createCounter('metric_name');
counter.add(10, { 'key': 'value' });

```

## GRPC

For GRPC please check [npm-url-grpc]

## PROTOBUF

For PROTOBUF please check [npm-url-proto]

## Running opentelemetry-collector locally to see the traces

1. Go to examples/collector-exporter-node
2. run `npm run docker:start`
3. Open page at `http://localhost:9411/zipkin/` to observe the traces

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-js/discussions
[license-url]: https://github.com/open-telemetry/opentelemetry-js/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[dependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-exporter-collector
[dependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-exporter-collector
[devDependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-exporter-collector&type=dev
[devDependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-exporter-collector&type=dev
[npm-url]: https://www.npmjs.com/package/@opentelemetry/exporter-collector
[npm-url-grpc]: https://www.npmjs.com/package/@opentelemetry/exporter-collector-grpc
[npm-url-proto]: https://www.npmjs.com/package/@opentelemetry/exporter-collector-proto
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Fexporter-collector.svg
[opentelemetry-collector-url]: https://github.com/open-telemetry/opentelemetry-collector
