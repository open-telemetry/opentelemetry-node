# OpenTelemetry Core

[![NPM Published Version][npm-img]][npm-url]
[![dependencies][dependencies-image]][dependencies-url]
[![devDependencies][devDependencies-image]][devDependencies-url]
[![Apache License][license-image]][license-image]

This package provides default implementations of the OpenTelemetry API for trace and metrics. It's intended for use both on the server and in the browser.

## Built-in Implementations

- [OpenTelemetry Core](#opentelemetry-core)
  - [Built-in Implementations](#built-in-implementations)
    - [Built-in Propagators](#built-in-propagators)
      - [HttpTraceContextPropagator Propagator](#httptracecontext-propagator)
      - [Composite Propagator](#composite-propagator)
      - [Baggage Propagator](#baggage-propagator)
    - [Built-in Sampler](#built-in-sampler)
      - [AlwaysOn Sampler](#alwayson-sampler)
      - [AlwaysOff Sampler](#alwaysoff-sampler)
      - [TraceIdRatioBased Sampler](#traceidratiobased-sampler)
      - [ParentBased Sampler](#parentbased-sampler)
  - [Useful links](#useful-links)
  - [License](#license)

### Built-in Propagators

#### HttpTraceContextPropagator Propagator

OpenTelemetry provides a text-based approach to propagate context to remote services using the [W3C Trace Context](https://www.w3.org/TR/trace-context/) HTTP headers.

```js
const api = require("@opentelemetry/api");
const { HttpTraceContextPropagator } = require("@opentelemetry/core");

/* Set Global Propagator */
api.propagation.setGlobalPropagator(new HttpTraceContextPropagator());
```

#### Composite Propagator

Combines multiple propagators into a single propagator.

> This is used as a default Propagator

```js
const api = require("@opentelemetry/api");
const { CompositePropagator } = require("@opentelemetry/core");

/* Set Global Propagator */
api.propagation.setGlobalPropagator(new CompositePropagator());
```

#### Baggage Propagator

Provides a text-based approach to propagate [baggage](https://w3c.github.io/baggage/) to remote services using the [OpenTelemetry Baggage Propagation](https://github.com/open-telemetry/opentelemetry-specification/blob/master/specification/baggage/api.md#baggage-propagation) HTTP headers.

```js
const api = require("@opentelemetry/api");
const { HttpBaggagePropagator } = require("@opentelemetry/core");

/* Set Global Propagator */
api.propagation.setGlobalPropagator(new HttpBaggagePropagator());
```

### Built-in Sampler

Sampler is used to make decisions on `Span` sampling.

#### AlwaysOn Sampler

Samples every trace regardless of upstream sampling decisions.

> This is used as a default Sampler

```js
const { NodeTracerProvider } = require("@opentelemetry/node");
const { AlwaysOnSampler } = require("@opentelemetry/core");

const tracerProvider = new NodeTracerProvider({
  sampler: new AlwaysOnSampler()
});
```

#### AlwaysOff Sampler

Doesn't sample any trace, regardless of upstream sampling decisions.

```js
const { NodeTracerProvider } = require("@opentelemetry/node");
const { AlwaysOffSampler } = require("@opentelemetry/core");

const tracerProvider = new NodeTracerProvider({
  sampler: new AlwaysOffSampler()
});
```

#### TraceIdRatioBased Sampler

Samples some percentage of traces, calculated deterministically using the trace ID.
Any trace that would be sampled at a given percentage will also be sampled at any higher percentage.

The `TraceIDRatioSampler` may be used with the `ParentBasedSampler` to respect the sampled flag of an incoming trace.

```js
const { NodeTracerProvider } = require("@opentelemetry/node");
const { TraceIdRatioBasedSampler } = require("@opentelemetry/core");

const tracerProvider = new NodeTracerProvider({
  // See details of ParentBasedSampler below
  sampler: new ParentBasedSampler({
    // Trace ID Ratio Sampler accepts a positional argument
    // which represents the percentage of traces which should
    // be sampled.
    root: new TraceIdRatioBasedSampler(0.5)
  });
});
```

#### ParentBased Sampler

- This is a composite sampler. `ParentBased` helps distinguished between the
following cases:
  - No parent (root span).
  - Remote parent with `sampled` flag `true`
  - Remote parent with `sampled` flag `false`
  - Local parent with `sampled` flag `true`
  - Local parent with `sampled` flag `false`

Required parameters:

- `root(Sampler)` - Sampler called for spans with no parent (root spans)

Optional parameters:

- `remoteParentSampled(Sampler)` (default: `AlwaysOn`)
- `remoteParentNotSampled(Sampler)` (default: `AlwaysOff`)
- `localParentSampled(Sampler)` (default: `AlwaysOn`)
- `localParentNotSampled(Sampler)` (default: `AlwaysOff`)

|Parent| parent.isRemote() | parent.isSampled()| Invoke sampler|
|--|--|--|--|
|absent| n/a | n/a |`root()`|
|present|true|true|`remoteParentSampled()`|
|present|true|false|`remoteParentNotSampled()`|
|present|false|true|`localParentSampled()`|
|present|false|false|`localParentNotSampled()`|

```js
const { NodeTracerProvider } = require("@opentelemetry/node");
const { ParentBasedSampler, AlwaysOffSampler, TraceIdRatioBasedSampler } = require("@opentelemetry/core");

const tracerProvider = new NodeTracerProvider({
  sampler: new ParentBasedSampler({
    // By default, the ParentBasedSampler will respect the parent span's sampling
    // decision. This is configurable by providing a different sampler to use
    // based on the situation. See configuration details above.
    //
    // This will delegate the sampling decision of all root traces (no parent)
    // to the TraceIdRatioBasedSampler.
    // See details of TraceIdRatioBasedSampler above.
    root: new TraceIdRatioBasedSampler(0.5)
  })
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
[dependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-core
[dependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-core
[devDependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-core&type=dev
[devDependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-core&type=dev
[npm-url]: https://www.npmjs.com/package/@opentelemetry/core
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Fcore.svg
