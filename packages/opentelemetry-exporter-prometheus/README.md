# OpenTelemetry Prometheus Metric Exporter

[![NPM Published Version][npm-img]][npm-url]
[![dependencies][dependencies-image]][dependencies-url]
[![devDependencies][devDependencies-image]][devDependencies-url]
[![Apache License][license-image]][license-image]

The OpenTelemetry Prometheus Metrics Exporter allows the user to send collected [OpenTelemetry Metrics](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-base-metrics) to Prometheus.

[Prometheus](https://prometheus.io/) is a monitoring system that collects metrics, by scraping exposed endpoints at regular intervals, evaluating rule expressions. It can also trigger alerts if certain conditions are met. For assistance setting up Prometheus, [Click here](https://opencensus.io/codelabs/prometheus/#0) for a guided codelab.

## Installation

```bash
npm install --save @opentelemetry/sdk-base-metrics
npm install --save @opentelemetry/exporter-prometheus
```

## Usage

Create & register the exporter on your application.

```js
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { MeterProvider }  = require('@opentelemetry/sdk-base-metrics');

// Add your port and startServer to the Prometheus options
const options = {port: 9464, startServer: true};
const exporter = new PrometheusExporter(options);

// Register the exporter
const meter = new MeterProvider({
  exporter,
  interval: 1000,
}).getMeter('example-prometheus');

// Now, start recording data
const counter = meter.createCounter('metric_name', {
  description: 'Example of a counter'
});
counter.add(10, { pid: process.pid });

// Record data using Instrument: It is recommended to keep a reference to the Bound Instrument instead of
// always calling `bind()` method for every operations.
const boundCounter = counter.bind({ pid: process.pid });
boundCounter.add(10);

// .. some other work
```

## Viewing your metrics

With the above you should now be able to navigate to the Prometheus UI at: <http://localhost:9464/metrics>

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- To learn more about Prometheus, visit: <https://prometheus.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-js/discussions
[license-url]: https://github.com/open-telemetry/opentelemetry-js/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[dependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-exporter-prometheus
[dependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-exporter-prometheus
[devDependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-exporter-prometheus&type=dev
[devDependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-exporter-prometheus&type=dev
[npm-url]: https://www.npmjs.com/package/@opentelemetry/exporter-prometheus
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Fexporter-prometheus.svg
