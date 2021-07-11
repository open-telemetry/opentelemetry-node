# OpenTelemetry Metrics SDK

[![NPM Published Version][npm-img]][npm-url]
[![dependencies][dependencies-image]][dependencies-url]
[![devDependencies][devDependencies-image]][devDependencies-url]
[![Apache License][license-image]][license-image]

OpenTelemetry metrics allow a user to collect data and export it to a metrics backend like [Prometheus](https://prometheus.io/).

## Installation

```bash
npm install --save @opentelemetry/sdk-base-metrics
```

## Usage

### Counter

Choose this kind of metric when the value is a quantity, the sum is of primary interest, and the event count and value distribution are not of primary interest. It is restricted to non-negative increments.
Example uses for Counter:

- count the number of bytes received
- count the number of requests completed
- count the number of accounts created
- count the number of checkpoints run
- count the number of 5xx errors.

```js
const { MeterProvider } = require('@opentelemetry/sdk-base-metrics');

// Initialize the Meter to capture measurements in various ways.
const meter = new MeterProvider().getMeter('your-meter-name');

const counter = meter.createCounter('metric_name', {
  description: 'Example of a counter'
});

const labels = { pid: process.pid };

// Create a BoundInstrument associated with specified label values.
const boundCounter = counter.bind(labels);
boundCounter.add(10);

```

### UpDownCounter

`UpDownCounter` is similar to `Counter` except that it supports negative increments. It is generally useful for capturing changes in an amount of resources used, or any quantity that rises and falls during a request.

Example uses for UpDownCounter:

- count the number of active requests
- count memory in use by instrumenting new and delete
- count queue size by instrumenting enqueue and dequeue
- count semaphore up and down operations

```js
const { MeterProvider } = require('@opentelemetry/sdk-base-metrics');

// Initialize the Meter to capture measurements in various ways.
const meter = new MeterProvider().getMeter('your-meter-name');

const counter = meter.createUpDownCounter('metric_name', {
  description: 'Example of a UpDownCounter'
});

const labels = { pid: process.pid };

// Create a BoundInstrument associated with specified label values.
const boundCounter = counter.bind(labels);
boundCounter.add(Math.random() > 0.5 ? 1 : -1);

```

### Value Observer

Choose this kind of metric when only last value is important without worry about aggregation.
The callback can be sync or async.

```js
const { MeterProvider } = require('@opentelemetry/sdk-base-metrics');

const meter = new MeterProvider().getMeter('your-meter-name');


// async callback - for operation that needs to wait for value
meter.createValueObserver('your_metric_name', {
  description: 'Example of an async observer with callback',
}, async (observerResult) => {
  const value = await getAsyncValue();
  observerResult.observe(value, { label: '1' });
});

function getAsyncValue() {
  return new Promise((resolve) => {
    setTimeout(()=> {
      resolve(Math.random());
    }, 100);
  });
}

// sync callback in case you don't need to wait for value
meter.createValueObserver('your_metric_name', {
  description: 'Example of a sync observer with callback',
}, (observerResult) => {
  observerResult.observe(getRandomValue(), { label: '1' });
  observerResult.observe(getRandomValue(), { label: '2' });
});

function getRandomValue() {
  return Math.random();
}
```

### UpDownSumObserver

Choose this kind of metric when sum is important and you want to capture any value that starts at zero and rises or falls throughout the process lifetime.
The callback can be sync or async.

```js
const { MeterProvider } = require('@opentelemetry/sdk-base-metrics');

const meter = new MeterProvider().getMeter('your-meter-name');

// async callback - for operation that needs to wait for value
meter.createUpDownSumObserver('your_metric_name', {
  description: 'Example of an async observer with callback',
}, async (observerResult) => {
  const value = await getAsyncValue();
  observerResult.observe(value, { label: '1' });
});

function getAsyncValue() {
  return new Promise((resolve) => {
    setTimeout(()=> {
      resolve(Math.random());
    }, 100);
  });
}

// sync callback in case you don't need to wait for value
meter.createUpDownSumObserver('your_metric_name', {
  description: 'Example of a sync observer with callback',
}, (observerResult) => {
  observerResult.observe(getRandomValue(), { label: '1' });
});

function getRandomValue() {
  return Math.random();
}

```

### Sum Observer

Choose this kind of metric when collecting a sum that never decreases.
The callback can be sync or async.

```js
const { MeterProvider } = require('@opentelemetry/sdk-base-metrics');

const meter = new MeterProvider().getMeter('your-meter-name');

// async callback in case you need to wait for values
meter.createSumObserver('example_metric', {
  description: 'Example of an async sum observer with callback',
}, async (observerResult) => {
  const value = await getAsyncValue();
  observerResult.observe(value, { label: '1' });
});

function getAsyncValue() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(Math.random());
    }, 100)
  });
}

// sync callback in case you don't need to wait for values
meter.createSumObserver('example_metric', {
  description: 'Example of a sync sum observer with callback',
}, (observerResult) => {
  const value = getRandomValue();
  observerResult.observe(value, { label: '1' });
});

function getRandomValue() {
  return Math.random();
}
```

### Batch Observer

Choose this kind of metric when you need to update multiple observers with the results of a single async calculation.

```js
const { MeterProvider } = require('@opentelemetry/sdk-base-metrics');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');

const exporter = new PrometheusExporter(
  {
    startServer: true,
  },
  () => {
    console.log('prometheus scrape endpoint: http://localhost:9464/metrics');
  },
);

const meter = new MeterProvider({
  exporter,
  interval: 3000,
}).getMeter('example-observer');

const cpuUsageMetric = meter.createValueObserver('cpu_usage_per_app', {
  description: 'CPU',
});

const MemUsageMetric = meter.createValueObserver('mem_usage_per_app', {
  description: 'Memory',
});

meter.createBatchObserver((observerBatchResult) => {
  getSomeAsyncMetrics().then(metrics => {
    observerBatchResult.observe({ app: 'myApp' }, [
      cpuUsageMetric.observation(metrics.value1),
      MemUsageMetric.observation(metrics.value2)
    ]);
  });
});

function getSomeAsyncMetrics() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve({
        value1: Math.random(),
        value2: Math.random(),
      });
    }, 100)
  });
}

```

See [examples/prometheus](https://github.com/open-telemetry/opentelemetry-js/tree/main/examples/prometheus) for a short example.

### Value Recorder

`ValueRecorder` is a non-additive synchronous instrument useful for recording any non-additive number, positive or negative.
Values captured by `ValueRecorder.record(value)` are treated as individual events belonging to a distribution that is being summarized.
`ValueRecorder` should be chosen either when capturing measurements that do not contribute meaningfully to a sum, or when capturing numbers that are additive in nature, but where the distribution of individual increments is considered interesting.

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-js/discussions
[license-url]: https://github.com/open-telemetry/opentelemetry-js/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[dependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-sdk-base-metrics
[dependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-metrsics
[devDependencies-image]: https://status.david-dm.org/gh/open-telemetry/opentelemetry-js.svg?path=packages%2Fopentelemetry-sdk-base-metrics&type=dev
[devDependencies-url]: https://david-dm.org/open-telemetry/opentelemetry-js?path=packages%2Fopentelemetry-sdk-base-metrics&type=dev
[npm-url]: https://www.npmjs.com/package/@opentelemetry/sdk-base-metrics
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Fmetrics.svg
