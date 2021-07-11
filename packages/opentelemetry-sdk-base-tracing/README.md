# OpenTelemetry Tracing SDK

[![NPM Published Version][npm-img]][npm-url]
[![dependencies][dependencies-image]][dependencies-url]
[![devDependencies][devDependencies-image]][devDependencies-url]
[![Apache License][license-image]][license-image]

The `tracing` module contains the foundation for all tracing SDKs of [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js).

Used standalone, this module provides methods for manual instrumentation of code, offering full control over span creation for client-side JavaScript (browser) and Node.js.

It does **not** provide automated instrumentation of known libraries, context propagation for asynchronous invocations or distributed-context out-of-the-box.

For automated instrumentation for Node.js, please see
[@opentelemetry/sdk-node-tracing](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-node-tracing).

## Installation

```bash
npm install --save @opentelemetry/api
npm install --save @opentelemetry/sdk-base-tracing
```

## Usage

```js
const opentelemetry = require('@opentelemetry/api');
const { BasicTracerProvider } = require('@opentelemetry/sdk-base-tracing');

// To start a trace, you first need to initialize the Tracer provider.
// NOTE: The default OpenTelemetry tracer provider does not record any tracing information.
//       Registering a working tracer provider allows the API methods to record traces.
new BasicTracerProvider().register();

// To create a span in a trace, we used the global singleton tracer to start a new span.
const span = opentelemetry.trace.getTracer('default').startSpan('foo');

// Set a span attribute
span.setAttribute('key', 'value');

// We must end the spans so they become available for exporting.
span.end();
```

## Config

Tracing configuration is a merge of user supplied configuration with both the default
configuration as specified in [config.ts](./src/config.ts) and an
environmentally configurable sampling (via `OTEL_TRACES_SAMPLER` and `OTEL_TRACES_SAMPLER_ARG`).

## Example

See [examples/basic-tracer-node](https://github.com/open-telemetry/opentelemetry-js/tree/main/examples/basic-tracer-node) for an end-to-end example, including exporting created spans.

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-js/discussions
[license-url]: https://github.com/open-telemetry/opentelemetry-js/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[dependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-sdk-base-tracing
[dependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-sdk-base-tracing
[devDependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-sdk-base-tracing&type=dev
[devDependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-sdk-base-tracing&type=dev
[npm-url]: https://www.npmjs.com/package/@opentelemetry/sdk-base-tracing
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Ftracing.svg
