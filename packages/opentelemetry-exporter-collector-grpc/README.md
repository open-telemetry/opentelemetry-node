# OpenTelemetry Collector Exporter for node with grpc

[![NPM Published Version][npm-img]][npm-url]
[![dependencies][dependencies-image]][dependencies-url]
[![devDependencies][devDependencies-image]][devDependencies-url]
[![Apache License][license-image]][license-image]

This module provides exporter for web and node to be used with [opentelemetry-collector][opentelemetry-collector-url] - last tested with version **0.25.0**.

## Installation

```bash
npm install --save @opentelemetry/exporter-collector-grpc
```

## Traces in Node - GRPC

The CollectorTraceExporter in Node expects the URL to only be the hostname. It will not work with `/v1/traces`.

```js
const { BasicTracerProvider, SimpleSpanProcessor } = require('@opentelemetry/tracing');
const { CollectorTraceExporter } =  require('@opentelemetry/exporter-collector-grpc');

const collectorOptions = {
  serviceName: 'basic-service',
  // url is optional and can be omitted - default is localhost:4317
  url: '<collector-hostname>:<port>',
};

const provider = new BasicTracerProvider();
const exporter = new CollectorTraceExporter(collectorOptions);
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

provider.register();
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => provider.shutdown().catch(console.error));
});
```

By default, plaintext connection is used. In order to use TLS in Node.js, provide `credentials` option like so:

```js
const fs = require('fs');
const grpc = require('@grpc/grpc-js');

const { BasicTracerProvider, SimpleSpanProcessor } = require('@opentelemetry/tracing');
const { CollectorTraceExporter } =  require('@opentelemetry/exporter-collector-grpc');

const collectorOptions = {
  serviceName: 'basic-service',
  // url is optional and can be omitted - default is localhost:4317
  url: '<collector-hostname>:<port>',
  credentials: grpc.credentials.createSsl(),
};

const provider = new BasicTracerProvider();
const exporter = new CollectorTraceExporter(collectorOptions);
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

provider.register();
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => provider.shutdown().catch(console.error));
});
```

To use mutual authentication, pass to the `createSsl()` constructor:

```js
  credentials: grpc.credentials.createSsl(
    fs.readFileSync('./ca.crt'),
    fs.readFileSync('./client.key'),
    fs.readFileSync('./client.crt')
  ),
```

To generate credentials for mutual authentication, you can refer to the script used to generate certificates for tests [here](./test/certs/regenerate.sh)

The exporter can be configured to send custom metadata with each request as in the example below:

```js
const grpc = require('@grpc/grpc-js');

const { BasicTracerProvider, SimpleSpanProcessor } = require('@opentelemetry/tracing');
const { CollectorTraceExporter } =  require('@opentelemetry/exporter-collector-grpc');

const metadata = new grpc.Metadata();
// For instance, an API key or access token might go here.
metadata.set('k', 'v');

const collectorOptions = {
  serviceName: 'basic-service',
  // url is optional and can be omitted - default is localhost:4317
  url: '<collector-hostname>:<port>',
  metadata, // // an optional grpc.Metadata object to be sent with each request
};

const provider = new BasicTracerProvider();
const exporter = new CollectorTraceExporter(collectorOptions);
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

provider.register();
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => provider.shutdown().catch(console.error));
});
```

Note, that this will only work if TLS is also configured on the server.

## Metrics in Node - GRPC

The CollectorTraceExporter in Node expects the URL to only be the hostname. It will not work with `/v1/metrics`. All options that work with trace also work with metrics.

```js
const { MeterProvider } = require('@opentelemetry/metrics');
const { CollectorMetricExporter } =  require('@opentelemetry/exporter-collector-grpc');
const collectorOptions = {
  serviceName: 'basic-service',
  // url is optional and can be omitted - default is localhost:4317
  url: '<collector-hostname>:<port>',
};
const exporter = new CollectorMetricExporter(collectorOptions);

// Register the exporter
const provider = new MeterProvider({
  exporter,
  interval: 60000,
})
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => provider.shutdown().catch(console.error));
});

// Now, start recording data
const meter = provider.getMeter('example-meter');
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
[dependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-exporter-collector-grpc
[dependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-exporter-collector-grpc
[devDependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-exporter-collector-grpc&type=dev
[devDependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-exporter-collector-grpc&type=dev
[npm-url]: https://www.npmjs.com/package/@opentelemetry/exporter-collector-grpc
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Fexporter-collector-grpc.svg
[opentelemetry-collector-url]: https://github.com/open-telemetry/opentelemetry-collector
