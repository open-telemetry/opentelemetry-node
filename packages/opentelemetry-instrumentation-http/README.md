# OpenTelemetry HTTP and HTTPS Instrumentation for Node.js

[![NPM Published Version][npm-img]][npm-url]
[![dependencies][dependencies-image]][dependencies-url]
[![devDependencies][devDependencies-image]][devDependencies-url]
[![Apache License][license-image]][license-image]

This module provides automatic instrumentation for [`http`](https://nodejs.org/api/http.html) and [`https`](https://nodejs.org/api/https.html).

For automatic instrumentation see the
[@opentelemetry/node](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-node) package.

## Installation

```bash
npm install --save @opentelemetry/instrumentation-http
```

## Usage

OpenTelemetry HTTP Instrumentation allows the user to automatically collect trace data and export them to their backend of choice, to give observability to distributed systems.

To load a specific instrumentation (HTTP in this case), specify it in the Node Tracer's configuration.

```js
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ConsoleSpanExporter, SimpleSpanProcessor } = require('@opentelemetry/tracing');
const { NodeTracerProvider } = require('@opentelemetry/node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');

const provider = new NodeTracerProvider();

provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
provider.register();

registerInstrumentations({
  instrumentations: [new HttpInstrumentation()],
});

```

See [examples/http](https://github.com/open-telemetry/opentelemetry-js/tree/main/examples/http) for a short example.

### Http instrumentation Options

Http instrumentation has few options available to choose from. You can set the following:

| Options | Type | Description |
| ------- | ---- | ----------- |
| [`applyCustomAttributesOnSpan`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-instrumentation-http/src/types.ts#L91) | `HttpCustomAttributeFunction` | Function for adding custom attributes |
| [`requestHook`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-instrumentation-http/src/types.ts#93) | `HttpRequestCustomAttributeFunction` | Function for adding custom attributes before request is handled |
| [`responseHook`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-instrumentation-http/src/types.ts#L95) | `HttpResponseCustomAttributeFunction` | Function for adding custom attributes before response is handled |
| [`startIncomingSpanHook`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-instrumentation-http/src/types.ts#L97) | `StartIncomingSpanCustomAttributeFunction` | Function for adding custom attributes before a span is started in incomingRequest |
| [`startOutgoingSpanHook`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-instrumentation-http/src/types.ts#L99) | `StartOutgoingSpanCustomAttributeFunction` | Function for adding custom attributes before a span is started in outgoingRequest |
| [`ignoreIncomingPaths`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-instrumentation-http/src/types.ts#L87) | `IgnoreMatcher[]` | Http instrumentation will not trace all incoming requests that match paths |
| [`ignoreOutgoingUrls`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-instrumentation-http/src/types.ts#L89) | `IgnoreMatcher[]` | Http instrumentation will not trace all outgoing requests that match urls |
| [`serverName`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-instrumentation-http/src/types.ts#L101) | `string` | The primary server name of the matched virtual host. |
| [`requireParentforOutgoingSpans`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-instrumentation-http/src/types.ts#L103) | Boolean | Require that is a parent span to create new span for outgoing requests. |
| [`requireParentforIncomingSpans`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-instrumentation-http/src/types.ts#L105) | Boolean | Require that is a parent span to create new span for incoming requests. |

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-js/discussions
[license-url]: https://github.com/open-telemetry/opentelemetry-js/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[dependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-instrumentation-http
[dependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-instrumentation-http
[devDependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-instrumentation-http&type=dev
[devDependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-instrumentation-http&type=dev
[npm-url]: https://www.npmjs.com/package/@opentelemetry/instrumentation-http
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Finstrumentation-http.svg
