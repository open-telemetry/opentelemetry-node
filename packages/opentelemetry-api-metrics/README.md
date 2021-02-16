# OpenTelemetry API for JavaScript

[![NPM Published Version][npm-img]][npm-url]
[![dependencies][dependencies-image]][dependencies-url]
[![devDependencies][devDependencies-image]][devDependencies-url]
[![Apache License][license-image]][license-image]

This package provides everything needed to interact with the unstable OpenTelemetry Metrics API, including all TypeScript interfaces, enums, and no-op implementations. It is intended for use both on the server and in the browser.

## Beta Software - Use at your own risk

The metrics API is considered alpha software and there is no guarantee of stability or long-term support. When the API is stabilized, it will be made available and supported long-term in the `@opentelemetry/api` package and this package will be deprecated.

## Quick Start

To get started you need to install the SDK and instrumentations, create a MeterProvider, and register it with the API.

### Install Dependencies

```sh
$ # Install metrics dependencies
$ npm install \
    @opentelemetry/api-metrics \
    @opentelemetry/metrics \
    @opentelemetry/exporter-prometheus # add exporters as needed
```

> Note: this example is for node.js. See [examples/tracer-web](https://github.com/open-telemetry/opentelemetry-js/tree/main/examples/tracer-web) for a browser example.

### Initialize the SDK

Before any other module in your application is loaded, you must initialize the global tracer and meter providers. If you fail to initialize a provider, no-op implementations will be provided to any library which acquires them from the API.

To collect traces and metrics, you will have to tell the SDK where to export telemetry data to. This example uses Jaeger and Prometheus, but exporters exist for [other tracing backends][other-tracing-backends]. If you're not sure if there is an exporter for your tracing backend, contact your tracing provider.

#### Metrics

```javascript
const api = require("@opentelemetry/api-metrics");
const { MeterProvider } = require("@opentelemetry/metrics");
const { PrometheusExporter } = require("@opentelemetry/exporter-prometheus");

const meterProvider = new MeterProvider({
  // The Prometheus exporter runs an HTTP server which
  // the Prometheus backend scrapes to collect metrics.
  exporter: new PrometheusExporter({ startServer: true }),
  interval: 1000,
});

/**
 * Registering the provider with the API allows it to be discovered
 * and used by instrumentation libraries.
 */
api.metrics.setGlobalMeterProvider(meterProvider);
```

## Version Compatibility

Because the npm installer and node module resolution algorithm could potentially allow two or more copies of any given package to exist within the same `node_modules` structure, the OpenTelemetry API takes advantage of a variable on the `global` object to store the global API. When an API method in the API package is called, it checks if this `global` API exists and proxies calls to it if and only if it is a compatible API version. This means if a package has a dependency on an OpenTelemetry API version which is not compatible with the API used by the end user, the package will receive a no-op implementation of the API.

## Advanced Use

### API Methods

If you are writing an instrumentation library, or prefer to call the API methods directly rather than using the `register` method on the Tracer/Meter Provider, OpenTelemetry provides direct access to the underlying API methods through the `@opentelemetry/api-metrics` package. API entry points are defined as global singleton objects `trace`, `metrics`, `propagation`, and `context` which contain methods used to initialize SDK implementations and acquire resources from the API.

```javascript
const api = require("@opentelemetry/api-metrics");

/* Initialize MeterProvider */
api.metrics.setGlobalMeterProvider(meterProvider);
/* returns meterProvider (no-op if a working provider has not been initialized) */
api.metrics.getMeterProvider();
/* returns a meter from the registered global meter provider (no-op if a working provider has not been initialized) */
api.metrics.getMeter(name, version);
```

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-js/discussions
[license-url]: https://github.com/open-telemetry/opentelemetry-js/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[dependencies-image]: https://david-dm.org/open-telemetry/opentelemetry-js/status.svg?path=packages/opentelemetry-api
[dependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-api
[devDependencies-image]: https://david-dm.org/open-telemetry/opentelemetry-js/dev-status.svg?path=packages/opentelemetry-api
[devDependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-api&type=dev
[npm-url]: https://www.npmjs.com/package/@opentelemetry/api-metrics
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Fapi.svg

[trace-api-docs]: https://open-telemetry.github.io/opentelemetry-js/classes/traceapi.html
[propagation-api-docs]: https://open-telemetry.github.io/opentelemetry-js/classes/propagationapi.html
[context-api-docs]: https://open-telemetry.github.io/opentelemetry-js/classes/contextapi.html

[web]: https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-web
[tracing]: https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-tracing
[node]: https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-node
[metrics]: https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-metrics

[other-tracing-backends]: https://github.com/open-telemetry/opentelemetry-js#trace-exporters
