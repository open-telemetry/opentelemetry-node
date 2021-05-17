# OpenTelemetry Collector Exporter for node with protobuf

[![NPM Published Version][npm-img]][npm-url]
[![dependencies][dependencies-image]][dependencies-url]
[![devDependencies][devDependencies-image]][devDependencies-url]
[![Apache License][license-image]][license-image]

This module provides exporter for node to be used with [opentelemetry-collector][opentelemetry-collector-url] - last tested with version **0.25.0**.

## Installation

```bash
npm install --save @opentelemetry/exporter-collector-proto
```

## Traces in Node - PROTO over http

```js
const { BasicTracerProvider, SimpleSpanProcessor } = require('@opentelemetry/tracing');
const { CollectorTraceExporter } =  require('@opentelemetry/exporter-collector-proto');

const collectorOptions = {
  serviceName: 'basic-service',
  url: '<opentelemetry-collector-url>', // url is optional and can be omitted - default is http://localhost:55681/v1/traces
  headers: {
    foo: 'bar'
  }, //an optional object containing custom headers to be sent with each request will only work with http
};

const provider = new BasicTracerProvider();
const exporter = new CollectorTraceExporter(collectorOptions);
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

provider.register();

```

## Metrics in Node - PROTO over http

```js
const { MeterProvider } = require('@opentelemetry/metrics');
const { CollectorMetricExporter } =  require('@opentelemetry/exporter-collector-proto');
const collectorOptions = {
  serviceName: 'basic-service',
  url: '<opentelemetry-collector-url>', // url is optional and can be omitted - default is http://localhost:55681/v1/metrics
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
[dependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-exporter-collector-proto
[dependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-exporter-collector-proto
[devDependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-exporter-collector-proto&type=dev
[devDependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-exporter-collector-proto&type=dev
[npm-url]: https://www.npmjs.com/package/@opentelemetry/exporter-collector-proto
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Fexporter-collector-proto.svg
[opentelemetry-collector-url]: https://github.com/open-telemetry/opentelemetry-collector
