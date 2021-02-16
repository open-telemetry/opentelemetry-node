# OpenTelemetry API for JavaScript

[![NPM Published Version][npm-img]][npm-url]
[![dependencies][dependencies-image]][dependencies-url]
[![devDependencies][devDependencies-image]][devDependencies-url]
[![Apache License][license-image]][license-image]

This package provides everything needed to interact with the OpenTelemetry API, including all TypeScript interfaces, enums, and no-op implementations. It is intended for use both on the server and in the browser.

## Quick Start

To get started you need to install the SDK and plugins, create a TracerProvider, and register it with the API.

### Install Dependencies

```sh
$ # Install tracing dependencies
$ npm install \
    @opentelemetry/api \
    @opentelemetry/core \
    @opentelemetry/node \
    @opentelemetry/tracing \
    @opentelemetry/exporter-jaeger \ # add exporters as needed
    @opentelemetry/plugin-http # add plugins as needed
```

> Note: this example is for node.js. See [examples/tracer-web](https://github.com/open-telemetry/opentelemetry-js/tree/main/examples/tracer-web) for a browser example.

### Initialize the SDK

Before any other module in your application is loaded, you must initialize the global tracer and meter providers. If you fail to initialize a provider, no-op implementations will be provided to any library which acquires them from the API.

To collect traces and metrics, you will have to tell the SDK where to export telemetry data to. This example uses Jaeger and Prometheus, but exporters exist for [other tracing backends][other-tracing-backends]. If you're not sure if there is an exporter for your tracing backend, contact your tracing provider.

#### Tracing

```javascript
const { NodeTracerProvider } = require("@opentelemetry/node");
const { SimpleSpanProcessor } = require("@opentelemetry/tracing");
const { JaegerExporter } = require("@opentelemetry/exporter-jaeger");

const tracerProvider = new NodeTracerProvider();

/**
 * The SimpleSpanProcessor does no batching and exports spans
 * immediately when they end. For most production use cases,
 * OpenTelemetry recommends use of the BatchSpanProcessor.
 */
tracerProvider.addSpanProcessor(
  new SimpleSpanProcessor(
    new JaegerExporter({
      serviceName: 'my-service'
    })
  )
);

/**
 * Registering the provider with the API allows it to be discovered
 * and used by instrumentation libraries. The OpenTelemetry API provides
 * methods to set global SDK implementations, but the default SDK provides
 * a convenience method named `register` which registers same defaults
 * for you.
 *
 * By default the NodeTracerProvider uses Trace Context for propagation
 * and AsyncHooksScopeManager for context management. To learn about
 * customizing this behavior, see API Registration Options below.
 */
tracerProvider.register();
```

## Version Compatibility

Because the npm installer and node module resolution algorithm could potentially allow two or more copies of any given package to exist within the same `node_modules` structure, the OpenTelemetry API takes advantage of a variable on the `global` object to store the global API. When an API method in the API package is called, it checks if this `global` API exists and proxies calls to it if and only if it is a compatible API version. This means if a package has a dependency on an OpenTelemetry API version which is not compatible with the API used by the end user, the package will receive a no-op implementation of the API.

## Advanced Use

### API Registration Options

If you prefer to choose your own propagator or context manager, you may pass an options object into the `tracerProvider.register()` method. Omitted or `undefined` options will be replaced by a default value and `null` values will be skipped.

```javascript
const { B3Propagator } = require("@opentelemetry/propagator-b3");

tracerProvider.register({
  // Use B3 Propagation
  propagator: new B3Propagator(),

  // Skip registering a default context manager
  contextManager: null,
});
```

### API Methods

If you are writing an instrumentation library, or prefer to call the API methods directly rather than using the `register` method on the Tracer/Meter Provider, OpenTelemetry provides direct access to the underlying API methods through the `@opentelemetry/api` package. API entry points are defined as global singleton objects `trace`, `metrics`, `propagation`, and `context` which contain methods used to initialize SDK implementations and acquire resources from the API.

- [Trace API Documentation][trace-api-docs]
- [Propagation API Documentation][propagation-api-docs]
- [Context API Documentation][context-api-docs]

```javascript
const api = require("@opentelemetry/api");

/* Initialize TracerProvider */
api.trace.setGlobalTracerProvider(tracerProvider);
/* returns tracerProvider (no-op if a working provider has not been initialized) */
api.trace.getTracerProvider();
/* returns a tracer from the registered global tracer provider (no-op if a working provider has not been initialized) */
api.trace.getTracer(name, version);

/* Initialize Propagator */
api.propagation.setGlobalPropagator(httpTraceContextPropagator);

/* Initialize Context Manager */
api.context.setGlobalContextManager(asyncHooksContextManager);
```

### Library Authors

Library authors need only to depend on the `@opentelemetry/api` package and trust that the application owners which use their library will initialize an appropriate SDK.

```javascript
const api = require("@opentelemetry/api");

const tracer = api.trace.getTracer("my-library-name", "0.2.3");

async function doSomething() {
  const span = tracer.startSpan("doSomething");
  try {
    const result = await doSomethingElse();
    span.end();
    return result;
  } catch (err) {
    span.setStatus({
      // use an appropriate status code here
      code: api.SpanStatusCode.ERROR,
      message: err.message,
    });
    span.end();
    return null;
  }
}
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
[npm-url]: https://www.npmjs.com/package/@opentelemetry/api
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Fapi.svg

[trace-api-docs]: https://open-telemetry.github.io/opentelemetry-js/classes/traceapi.html
[propagation-api-docs]: https://open-telemetry.github.io/opentelemetry-js/classes/propagationapi.html
[context-api-docs]: https://open-telemetry.github.io/opentelemetry-js/classes/contextapi.html

[web]: https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-web
[tracing]: https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-tracing
[node]: https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-node
[metrics]: https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-metrics

[other-tracing-backends]: https://github.com/open-telemetry/opentelemetry-js#trace-exporters
