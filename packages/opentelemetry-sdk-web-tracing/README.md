# OpenTelemetry Web SDK

[![NPM Published Version][npm-img]][npm-url]
[![dependencies][dependencies-image]][dependencies-url]
[![devDependencies][devDependencies-image]][devDependencies-url]
[![Apache License][license-image]][license-image]

This module provides *automated instrumentation and tracing* for Web applications.

For manual instrumentation see the
[@opentelemetry/sdk-base-tracing](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-base-tracing) package.

## How does automatic tracing work

This package exposes a class `WebTracerProvider` that will be able to automatically trace things in Browser only.

See the example how to use it.

OpenTelemetry comes with a growing number of instrumentations for well know modules (see [supported modules](https://github.com/open-telemetry/opentelemetry-js#plugins)) and an API to create custom instrumentations (see [the instrumentation developer guide](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/instrumentation-guide.md)).

Web Tracer currently supports one plugin for document load.
Unlike Node Tracer (`NodeTracerProvider`), the plugins needs to be initialised and passed in configuration.
The reason is to give user full control over which plugin will be bundled into web page.

You can choose to use the `ZoneContextManager` if you want to trace asynchronous operations. Please note that the `ZoneContextManager` does not work with JS code targeting `ES2017+`. In order to use the `ZoneContextManager`, please transpile back to `ES2015`.

## Installation

```bash
npm install --save @opentelemetry/sdk-web-tracing
```

## Usage

```js
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-base-tracing';
import { WebTracerProvider } from '@opentelemetry/sdk-web-tracing';
import { DocumentLoad } from '@opentelemetry/plugin-document-load';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

const provider = new WebTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

provider.register({
  // Changing default contextManager to use ZoneContextManager - supports asynchronous operations - optional
  contextManager: new ZoneContextManager(),
});

// Registering instrumentations / plugins
registerInstrumentations({
  instrumentations: [
    new DocumentLoad(),
  ],
});

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
[dependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-sdk-web-tracing
[dependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-sdk-web-tracing
[devDependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-sdk-web-tracing&type=dev
[devDependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-sdk-web-tracing&type=dev
[npm-url]: https://www.npmjs.com/package/@opentelemetry/sdk-web-tracing
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Fweb.svg
