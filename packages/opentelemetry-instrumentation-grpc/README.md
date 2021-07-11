# OpenTelemetry gRPC Instrumentation for Node.js

[![NPM Published Version][npm-img]][npm-url]
[![dependencies][dependencies-image]][dependencies-url]
[![devDependencies][devDependencies-image]][devDependencies-url]
[![Apache License][license-image]][license-image]

This module provides automatic instrumentation for [`grpc`](https://grpc.github.io/grpc/node/) and [`@grpc/grpc-js`](https://grpc.io/blog/grpc-js-1.0/). Currently, version [`1.x`](https://www.npmjs.com/package/grpc?activeTab=versions) of `grpc` and version [`1.x`](https://www.npmjs.com/package/@grpc/grpc-js?activeTab=versions) of `@grpc/grpc-js` is supported.

For automatic instrumentation see the
[@opentelemetry/sdk-node-tracing](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-node-tracing) package.

## Installation

```sh
npm install --save @opentelemetry/instrumentation-grpc
```

## Usage

OpenTelemetry gRPC Instrumentation allows the user to automatically collect trace data and export them to the backend of choice, to give observability to distributed systems when working with [gRPC](https://www.npmjs.com/package/grpc) or ([grpc-js](https://www.npmjs.com/package/@grpc/grpc-js)).

To load a specific instrumentation (**gRPC** in this case), specify it in the Node Tracer's configuration.

```javascript
const { NodeTracerProvider } = require('@opentelemetry/sdk-node-tracing');
const { GrpcInstrumentation } = require('@opentelemetry/instrumentation-grpc');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');

const provider = new NodeTracerProvider();

provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
provider.register();

registerInstrumentations({
  instrumentations: [new GrpcInstrumentation()]
});

```

See [examples/grpc](https://github.com/open-telemetry/opentelemetry-js/tree/main/examples/grpc) or [examples/grpc-js](https://github.com/open-telemetry/opentelemetry-js/tree/main/examples/grpc-js) for examples.

### gRPC Instrumentation Options

gRPC instrumentation accepts the following configuration:

| Options | Type | Description |
| ------- | ---- | ----------- |
| [`ignoreGrpcMethods`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-instrumentation-grpc/src/types.ts#L32) | `IgnoreMatcher[]` | gRPC instrumentation will not trace any methods that match anything in this list. You may pass a string (case-insensitive match), a `RegExp` object, or a filter function. |

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-js/discussions
[license-url]: https://github.com/open-telemetry/opentelemetry-js/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[dependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-instrumentation-grpc
[dependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-instrumentation-grpc
[devDependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-instrumentation-grpc&type=dev
[devDependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-instrumentation-grpc&type=dev
[npm-url]: https://www.npmjs.com/package/@opentelemetry/instrumentation-grpc
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Finstrumentation-grpc.svg
