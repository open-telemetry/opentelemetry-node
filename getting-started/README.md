# Getting started with OpenTelemetry JS

This guide walks you through the setup and configuration process for a tracing backend (in this case [Zipkin](https://zipkin.io), but [Jaeger](https://www.jaegertracing.io) is simple to use as well), a metrics backend like [Prometheus](https://prometheus.io), and auto-instrumentation of NodeJS. [You can find the guide for TypeScript here](ts-example/README.md#getting-started-with-opentelemetry-js-typescript).

- [Getting started with OpenTelemetry JS](#getting-started-with-opentelemetry-js)
  - [Trace your application with OpenTelemetry](#trace-your-application-with-opentelemetry)
    - [Set up a tracing backend](#set-up-a-tracing-backend)
    - [Trace your NodeJS application](#trace-your-nodejs-application)
      - [Install the required OpenTelemetry libraries](#install-the-required-opentelemetry-libraries)
      - [Initialize a global tracer](#initialize-a-global-tracer)
      - [Initialize and register a trace exporter](#initialize-and-register-a-trace-exporter)
  - [Collect metrics using OpenTelemetry](#collect-metrics-using-opentelemetry)
    - [Set up a metrics backend](#set-up-a-metrics-backend)
    - [Monitor your NodeJS application](#monitor-your-nodejs-application)
      - [Install the required OpenTelemetry metrics libraries](#install-the-required-opentelemetry-metrics-libraries)
      - [Initialize a meter and collect metrics](#initialize-a-meter-and-collect-metrics)
      - [Initialize and register a metrics exporter](#initialize-and-register-a-metrics-exporter)

## Trace your application with OpenTelemetry

([link to TypeScript version](ts-example/README.md#trace-your-application-with-opentelemetry))

This guide assumes you're using Zipkin as your tracing backend, but modifying it for Jaeger should be straightforward.

You can find an example application to use with this guide in the [example directory](example). See what it looks like with tracing enabled in the [traced-example directory](traced-example).

### Set up a tracing backend

([link to TypeScript version](ts-example/README.md#set-up-a-tracing-backend))

The first thing you need before you can start collecting traces is a tracing backend like Zipkin that you can export traces to. If you already have a supported tracing backend (Zipkin or Jaeger), you can skip this step. If not, you need to run one.

To set up Zipkin as quickly as possible, run the latest [Docker Zipkin](https://github.com/openzipkin/docker-zipkin) container, exposing port `9411`. If you can’t run Docker containers, you need to download and run Zipkin by following the Zipkin [quickstart guide](https://zipkin.io/pages/quickstart.html).

```sh
docker run --rm -d -p 9411:9411 --name zipkin openzipkin/zipkin
```

Browse to <http://localhost:9411> to make sure you can see the Zipkin UI.

<p align="center"><img src="./images/zipkin.png?raw=true"/></p>

### Trace your NodeJS application

([link to TypeScript version](ts-example/README.md#trace-your-nodejs-application))

This guide uses the example application provided in the [example directory](example), but the steps to instrument your own application should be broadly the same. Here's an overview of what you'll be doing:

1. Install the required OpenTelemetry libraries
2. Initialize a global tracer
3. Initialize and register a trace exporter

#### Install the required OpenTelemetry libraries

([link to TypeScript version](ts-example/README.md#install-the-required-opentelemetry-libraries))

To create traces on NodeJS, you need `@opentelemetry/node`, `@opentelemetry/core`, and any instrumentation required by your application such as gRPC or HTTP. If you're using the example application, you need to install `@opentelemetry/instrumentation-http` and `@opentelemetry/instrumentation-express`.

```sh
$ npm install \
  @opentelemetry/api \
  @opentelemetry/node \
  @opentelemetry/instrumentation-http \
  @opentelemetry/instrumentation-express \
  @opentelemetry/instrumentation-grpc
```

#### Initialize a global tracer

([link to TypeScript version](ts-example/README.md#initialize-a-global-tracer))

All tracing initialization should happen before your application code runs. The easiest way to do this is to initialize tracing in a separate file that is required using the `node` `-r` option before your application code runs.

Create a file named `tracing.js` and add the following code:

```javascript
'use strict';

const { diag, DiagConsoleLogger, DiagLogLevel } = require("@opentelemetry/api");
const { NodeTracerProvider } = require("@opentelemetry/node");
const { registerInstrumentations } = require("@opentelemetry/instrumentation");
const { HttpInstrumentation } = require("@opentelemetry/instrumentation-http");
const { GrpcInstrumentation } = require("@opentelemetry/instrumentation-grpc");

const provider = new NodeTracerProvider();

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL);

provider.register();

registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation(),
    new GrpcInstrumentation(),
  ],
});

```

Now, if you run your application with `node -r ./tracing.js app.js`, your application will create and propagate traces over HTTP. If an already instrumented service that supports [Trace Context](https://www.w3.org/TR/trace-context/) headers calls your application using HTTP, and you call another application using HTTP, the Trace Context headers will be correctly propagated.

However, if you want to see a completed trace, you need to register an exporter to send traces to a tracing backend.

#### Initialize and register a trace exporter

([link to TypeScript version](ts-example/README.md#initialize-and-register-a-trace-exporter))

This guide uses the Zipkin tracing backend. However, if you're using another backend like [Jaeger](https://www.jaegertracing.io), make your change there.

To export traces, you need a few more dependencies. Install them with the following command:

```sh
$ npm install \
  @opentelemetry/tracing \
  @opentelemetry/exporter-zipkin

$ # for jaeger you would run this command:
$ # npm install @opentelemetry/exporter-jaeger
```

After you install these dependencies, initialize and register them. Modify `tracing.js` so it matches the following code snippet. Optionally replace the service name `"getting-started"` with your own service name:

```javascript
'use strict';

const { diag, DiagConsoleLogger, DiagLogLevel } = require("@opentelemetry/api");
const { NodeTracerProvider } = require("@opentelemetry/node");
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { SimpleSpanProcessor } = require("@opentelemetry/tracing");
const { ZipkinExporter } = require("@opentelemetry/exporter-zipkin");
const { registerInstrumentations } = require("@opentelemetry/instrumentation");
const { HttpInstrumentation } = require("@opentelemetry/instrumentation-http");
const { GrpcInstrumentation } = require("@opentelemetry/instrumentation-grpc");

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "getting-started",
  })
});

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL);

provider.addSpanProcessor(
  new SimpleSpanProcessor(
    new ZipkinExporter({
      // If you are running your tracing backend on another host,
      // you can point to it using the `url` parameter of the
      // exporter config.
    })
  )
);

provider.register();

registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation(),
    new GrpcInstrumentation(),
  ],
});

console.log("tracing initialized");
```

Now if you run your application with the `tracing.js` file loaded, and you send requests to your application over HTTP (in the sample application just browse to <http://localhost:8080>), you'll see traces exported to your tracing backend that look like this:

```sh
node -r ./tracing.js app.js
```

<p align="center"><img src="./images/zipkin-trace.png?raw=true"/></p>

**Note:** Some spans appear to be duplicated, but they're not. This is because the sample application is both the client and the server for these requests. You see one span which is the client-side request timing, and one span which is the server side request timing. Anywhere they don’t overlap is network time.

## Collect metrics using OpenTelemetry

([link to TypeScript version](ts-example/README.md#collect-metrics-using-opentelemetry))

This guide assumes you're using Prometheus as your metrics backend. It's currently the only metrics backend supported by OpenTelemetry JS.

**Note**: This section is a work in progress.

### Set up a metrics backend

([link to TypeScript version](ts-example/README.md#set-up-a-metrics-backend))

Now that you have end-to-end traces, you can collect and export some basic metrics.

Currently, the only supported metrics backend is [Prometheus](https://prometheus.io). Go to the [Prometheus download page](https://prometheus.io/download/) and download the latest release of Prometheus for your operating system.

Open a command line and `cd` into the directory where you downloaded the Prometheus tarball. Untar it into the newly created directory.

```sh
$ cd Downloads

$ # Replace the file name below with your downloaded tarball
$ tar xvfz prometheus-2.20.1.darwin-amd64.tar

$ # Replace the dir below with your created directory
$ cd prometheus-2.20.1.darwin-amd64

$ ls
LICENSE           console_libraries data              prometheus.yml    tsdb
NOTICE            consoles          prometheus        promtool
```

The created directory should have a file named `prometheus.yml`. This is the file used to configure Prometheus. For now, just make sure Prometheus starts by running the `./prometheus` binary in the folder and browse to <http://localhost:9090>.

```sh
$ ./prometheus
# some output elided for brevity
msg="Starting Prometheus" version="(version=2.14.0, branch=HEAD, revision=edeb7a44cbf745f1d8be4ea6f215e79e651bfe19)"
# some output elided for brevity
level=info ts=2019-11-21T20:39:40.262Z caller=web.go:496 component=web msg="Start listening for connections" address=0.0.0.0:9090
# some output elided for brevity
level=info ts=2019-11-21T20:39:40.383Z caller=main.go:626 msg="Server is ready to receive web requests."
```

<p align="center"><img src="./images/prometheus.png?raw=true"/></p>

Once you confirm that Prometheus starts, replace the contents of `prometheus.yml` with the following:

```yaml
# my global config
global:
  scrape_interval: 15s # Set the scrape interval to every 15 seconds.

scrape_configs:
  - job_name: 'opentelemetry'
    # metrics_path defaults to '/metrics'
    # scheme defaults to 'http'.
    static_configs:
      - targets: ['localhost:9464']
```

### Monitor your NodeJS application

([link to TypeScript version](ts-example/README.md#monitor-your-nodejs-application))

You can find an example application to use with this guide in the [example directory](example). See what it looks like with metric monitoring enabled in the [monitored-example directory](monitored-example).

Here's an overview of what you'll be doing:

1. Install the required OpenTelemetry metrics libraries
2. Initialize a meter and collect metrics
3. Initialize and register a metrics exporter

#### Install the required OpenTelemetry metrics libraries

([link to TypeScript version](ts-example/README.md#install-the-required-opentelemetry-metrics-libraries))

To create metrics on NodeJS, you need `@opentelemetry/metrics`.

```sh
$ npm install \
  @opentelemetry/metrics
```

#### Initialize a meter and collect metrics

([link to TypeScript version](ts-example/README.md#initialize-a-meter-and-collect-metrics))

You need a `Meter` to create and monitor metrics. A `Meter` in OpenTelemetry is the mechanism used to create and manage metrics, labels, and metric exporters.

Create a file named `monitoring.js` and add the following code:

```javascript
'use strict';

const { MeterProvider } = require('@opentelemetry/metrics');

const meter = new MeterProvider().getMeter('your-meter-name');
```

Now you can require this file from your application code and use the `Meter` to create and manage metrics. The simplest of these metrics is a counter. Create and export from your `monitoring.js` file a middleware function that express can use to count all requests by route. Modify the `monitoring.js` file so it looks like this:

```javascript
'use strict';

const { MeterProvider } = require('@opentelemetry/metrics');

const meter = new MeterProvider().getMeter('your-meter-name');

const requestCount = meter.createCounter("requests", {
  description: "Count all incoming requests"
});

const boundInstruments = new Map();

module.exports.countAllRequests = () => {
  return (req, res, next) => {
    if (!boundInstruments.has(req.path)) {
      const labels = { route: req.path };
      const boundCounter = requestCount.bind(labels);
      boundInstruments.set(req.path, boundCounter);
    }

    boundInstruments.get(req.path).add(1);
    next();
  };
};
```

Now import and use this middleware in your application code:

```javascript
const { countAllRequests } = require("./monitoring");
const app = express();
app.use(countAllRequests());
```

Now when you make requests to your service, your meter will count all requests.

**Note**: Creating a new `labelSet` and `binding` on every request is not ideal because creating the `labelSet` can often be an expensive operation. Therefore, the instruments are created and stored in a `Map` according to the route key.

#### Initialize and register a metrics exporter

([link to TypeScript version](ts-example/README.md#initialize-and-register-a-metrics-exporter))

Counting metrics is only useful if you can export them somewhere where you can see them. For this, w'ere going to use Prometheus. Creating and registering a metrics exporter is much like the tracing exporter above. First you need to install the Prometheus exporter by running the following command:

```sh
npm install @opentelemetry/exporter-prometheus
```

Next, modify your `monitoring.js` file to look like this:

```javascript
"use strict";

const { MeterProvider } = require('@opentelemetry/metrics');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');

const prometheusPort = PrometheusExporter.DEFAULT_OPTIONS.port
const prometheusEndpoint = PrometheusExporter.DEFAULT_OPTIONS.endpoint

const exporter = new PrometheusExporter(
  {
    startServer: true,
  },
  () => {
    console.log(
      `prometheus scrape endpoint: http://localhost:${prometheusPort}${prometheusEndpoint}`,
    );
  },
);

const meter = new MeterProvider({
  exporter,
  interval: 1000,
}).getMeter('your-meter-name');

const requestCount = meter.createCounter("requests", {
  description: "Count all incoming requests"
});

const boundInstruments = new Map();

module.exports.countAllRequests = () => {
  return (req, res, next) => {
    if (!boundInstruments.has(req.path)) {
      const labels = { route: req.path };
      const boundCounter = requestCount.bind(labels);
      boundInstruments.set(req.path, boundCounter);
    }

    boundInstruments.get(req.path).add(1);
    next();
  };
};
```

Ensure Prometheus is running by running the `prometheus` binary from earlier and start your application.

```sh
$ npm start

> @opentelemetry/getting-started@1.0.0 start /App/opentelemetry-js/getting-started/monitored-example
> node app.js

prometheus scrape endpoint: http://localhost:9464/metrics
Listening for requests on http://localhost:8080
```

Now each time you browse to <http://localhost:8080> you should see "Hello from the backend" in your browser and your metrics in Prometheus should update. You can verify the current metrics by browsing to <http://localhost:9464/metrics>, which should look like this:

```sh
# HELP requests Count all incoming requests
# TYPE requests counter
requests{route="/"} 1
requests{route="/middle-tier"} 2
requests{route="/backend"} 4
```

You should also be able to see gathered metrics in your Prometheus web UI.

<p align="center"><img src="./images/prometheus-graph.png?raw=true"/></p>
