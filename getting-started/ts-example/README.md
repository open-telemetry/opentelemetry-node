# Getting Started with OpenTelemetry JS (TypeScript)

This TypeScript guide will walk you through the setup and configuration process for a tracing backend (in this case [Zipkin](https://zipkin.io), but [Jaeger](https://www.jaegertracing.io) would be simple to use as well), a metrics backend like [Prometheus](https://prometheus.io), and auto-instrumentation of NodeJS. [You can find the guide for JavaScript here](../README.md#getting-started-with-opentelemetry-js).

- [Getting Started with OpenTelemetry JS (TypeScript)](#getting-started-with-opentelemetry-js-typescript)
  - [Tracing Your Application with OpenTelemetry](#tracing-your-application-with-opentelemetry)
    - [Setting up a Tracing Backend](#setting-up-a-tracing-backend)
    - [Trace Your NodeJS Application](#trace-your-nodejs-application)
      - [Install the required OpenTelemetry libraries](#install-the-required-opentelemetry-libraries)
      - [Initialize a global tracer](#initialize-a-global-tracer)
      - [Initialize and Register a Trace Exporter](#initialize-and-register-a-trace-exporter)
  - [Collect Metrics Using OpenTelemetry](#collect-metrics-using-opentelemetry)
    - [Set up a Metrics Backend](#set-up-a-metrics-backend)
    - [Monitor Your NodeJS Application](#monitor-your-nodejs-application)
      - [Install the required OpenTelemetry metrics libraries](#install-the-required-opentelemetry-metrics-libraries)
      - [Initialize a meter and collect metrics](#initialize-a-meter-and-collect-metrics)
      - [Initialize and register a metrics exporter](#initialize-and-register-a-metrics-exporter)

## Tracing Your Application with OpenTelemetry

([link to JavaScript version](../README.md#tracing-your-application-with-opentelemetry))

This guide assumes you are going to be using Zipkin as your tracing backend, but modifying it for Jaeger should be straightforward.

An example application which can be used with this guide can be found in the [example directory](example). You can see what it looks like with tracing enabled in the [traced-example directory](traced-example).

### Setting up a Tracing Backend

([link to JavaScript version](../README.md#setting-up-a-tracing-backend))

The first thing we will need before we can start collecting traces is a tracing backend like Zipkin that we can export traces to. If you already have a supported tracing backend (Zipkin or Jaeger), you can skip this step. If not, you will need to run one.

In order to set up Zipkin as quickly as possible, run the latest [Docker Zipkin](https://github.com/openzipkin/docker-zipkin) container, exposing port `9411`. If you can’t run Docker containers, you will need to download and run Zipkin by following the Zipkin [quickstart guide](https://zipkin.io/pages/quickstart.html).

```sh
docker run --rm -d -p 9411:9411 --name zipkin openzipkin/zipkin
```

Browse to <http://localhost:9411> to ensure that you can see the Zipkin UI.

<p align="center"><img src="../images/zipkin.png?raw=true"/></p>

### Trace Your NodeJS Application

([link to JavaScript version](../README.md#trace-your-nodejs-application))

This guide uses the example application provided in the [example directory](example) but the steps to instrument your own application should be broadly the same. Here is an overview of what we will be doing.

1. Install the required OpenTelemetry libraries
2. Initialize a global tracer
3. Initialize and register a trace exporter

#### Install the required OpenTelemetry libraries

([link to JavaScript version](../README.md#install-the-required-opentelemetry-libraries))

To create traces on NodeJS, you will need `@opentelemetry/node`, `@opentelemetry/core`, and any plugins required by your application such as gRPC, or HTTP. If you are using the example application, you will need to install `@opentelemetry/plugin-http`.

```sh
$ npm install \
  @opentelemetry/core \
  @opentelemetry/node \
  @opentelemetry/instrumentation \
  @opentelemetry/instrumentation-http \
  @opentelemetry/instrumentation-express
```

#### Initialize a global tracer

([link to JavaScript version](../README.md#initialize-a-global-tracer))

All tracing initialization should happen before your application’s code runs. The easiest way to do this is to initialize tracing in a separate file that is required using node’s `-r` option before application code runs.

Create a file named `tracing.ts` and add the following code:

```typescript
import { LogLevel } from '@opentelemetry/core';
import { NodeTracerProvider } from '@opentelemetry/node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';


const provider: NodeTracerProvider = new NodeTracerProvider({
  logLevel: LogLevel.ERROR,
});

provider.register();

registerInstrumentations({
  instrumentations: [
    new ExpressInstrumentation(),
    new HttpInstrumentation(),
  ],
});

```

If you run your application now with `ts-node -r ./tracing.ts app.ts`, your application will create and propagate traces over HTTP. If an already instrumented service that supports [Trace Context](https://www.w3.org/TR/trace-context/) headers calls your application using HTTP, and you call another application using HTTP, the Trace Context headers will be correctly propagated.

If you wish to see a completed trace, however, there is one more step. You must register an exporter to send traces to a tracing backend.

#### Initialize and Register a Trace Exporter

([link to JavaScript version](../README.md#initialize-and-register-a-trace-exporter))

This guide uses the Zipkin tracing backend, but if you are using another backend like [Jaeger](https://www.jaegertracing.io), this is where you would make your change.

To export traces, we will need a few more dependencies. Install them with the following command:

```sh
$ npm install \
  @opentelemetry/tracing \
  @opentelemetry/exporter-zipkin

$ # for jaeger you would run this command:
$ # npm install @opentelemetry/exporter-jaeger
```

After these dependencies are installed, we will need to initialize and register them. Modify `tracing.ts` so that it matches the following code snippet, replacing the service name `"getting-started"` with your own service name if you wish.

```typescript
import { LogLevel } from '@opentelemetry/core';
import { NodeTracerProvider } from '@opentelemetry/node';

import { SimpleSpanProcessor } from '@opentelemetry/tracing';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
// For Jaeger, use the following line instead:
// import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const provider: NodeTracerProvider = new NodeTracerProvider({
  logLevel: LogLevel.ERROR,
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'getting-started',
  }),
});

provider.addSpanProcessor(
  new SimpleSpanProcessor(
    new ZipkinExporter({
      // For Jaeger, use the following line instead:
      // new JaegerExporter({
      // If you are running your tracing backend on another host,
      // you can point to it using the `url` parameter of the
      // exporter config.
    }),
  ),
);

provider.register();

registerInstrumentations({
  instrumentations: [
    new ExpressInstrumentation(),
    new HttpInstrumentation(),
  ],
});


console.log('tracing initialized');
```

Now if you run your application with the `tracing.ts` file loaded, and you send requests to your application over HTTP (in the sample application just browse to <http://localhost:8080),> you will see traces exported to your tracing backend that look like this:

```sh
ts-node -r ./tracing.ts app.ts
```

<p align="center"><img src="../images/zipkin-trace.png?raw=true"/></p>

**Note:** Some spans appear to be duplicated, but they are not. This is because the sample application is both the client and the server for these requests. You see one span that is the client side request timing, and one span that is the server side request timing. Anywhere they don’t overlap is network time.

## Collect Metrics Using OpenTelemetry

([link to JavaScript version](../README.md#collect-metrics-using-opentelemetry))

This guide assumes you are going to be using Prometheus as your metrics backend. It is currently the only metrics backend supported by OpenTelemetry JS.

**Note**: This section is a work in progress

### Set up a Metrics Backend

([link to JavaScript version](../README.md#set-up-a-metrics-backend))

Now that we have end-to-end traces, we will collect and export some basic metrics.

Currently, the only supported metrics backend is [Prometheus](https://prometheus.io). Head to the [Prometheus download page](https://prometheus.io/download/) and download the latest release of Prometheus for your operating system.

Open a command line and `cd` into the directory where you downloaded the Prometheus tarball. Untar it and change into the newly created directory.

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

<p align="center"><img src="../images/prometheus.png?raw=true"/></p>

Once we know prometheus starts, replace the contents of `prometheus.yml` with the following:

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

### Monitor Your NodeJS Application

([link to JavaScript version](../README.md#monitor-your-nodejs-application))

An example application which can be used with this guide can be found at in the [example directory](example). You can see what it looks like with metric monitoring enabled in the [monitored-example directory](monitored-example).

1. Install the required OpenTelemetry metrics libraries
2. Initialize a meter and collect metrics
3. Initialize and register a metrics exporter

#### Install the required OpenTelemetry metrics libraries

([link to JavaScript version](../README.md#install-the-required-opentelemetry-metrics-libraries))

To create metrics on NodeJS, you will need `@opentelemetry/metrics`.

```sh
npm install @opentelemetry/metrics
```

#### Initialize a meter and collect metrics

([link to JavaScript version](../README.md#initialize-a-meter-and-collect-metrics))

In order to create and monitor metrics, we will need a `Meter`. In OpenTelemetry, a `Meter` is the mechanism used to create and manage metrics, labels, and metric exporters.

Create a file named `monitoring.ts` and add the following code:

```typescript
import { MeterProvider } from '@opentelemetry/metrics';

const meter = new MeterProvider().getMeter('your-meter-name');
```

Now, you can require this file from your application code and use the `Meter` to create and manage metrics. The simplest of these metrics is a counter. Let's create and export from our `monitoring.ts` file a middleware function that express can use to count all requests by route. Modify the `monitoring.ts` file so that it looks like this:

```typescript
import { MeterProvider } from '@opentelemetry/metrics';
import { Request, Response, NextFunction } from 'express';

const meter = new MeterProvider().getMeter('your-meter-name');

const requestCount = meter.createCounter('requests', {
  description: 'Count all incoming requests',
});

const handles = new Map();

export const countAllRequests = () => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!handles.has(req.path)) {
      const labels = { route: req.path };
      const handle = requestCount.bind(labels);
      handles.set(req.path, handle);
    }

    handles.get(req.path).add(1);
    next();
  };
};
```

Now let's import and use this middleware in our application code:

```typescript
import { countAllRequests } from './monitoring';
const app = express();
app.use(countAllRequests());
```

Now, when we make requests to our service our meter will count all requests.

**Note**: Creating a new `labelSet` and `handle` on every request is not ideal as creating the `labelSet` can often be an expensive operation. This is why handles are created and stored in a `Map` according to the route key.

#### Initialize and register a metrics exporter

([link to JavaScript version](../README.md#initialize-and-register-a-metrics-exporter))

Counting metrics is only useful if we can export them somewhere that we can see them. For this, we're going to use prometheus. Creating and registering a metrics exporter is much like the tracing exporter above. First we will need to install the prometheus exporter.

```sh
npm install @opentelemetry/exporter-prometheus
```

Next, modify your `monitoring.ts` file to look like this:

```typescript
import { Request, Response, NextFunction } from 'express';
import { MeterProvider } from '@opentelemetry/metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

const prometheusPort = PrometheusExporter.DEFAULT_OPTIONS.port;
const prometheusEndpoint = PrometheusExporter.DEFAULT_OPTIONS.endpoint;

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

const requestCount = meter.createCounter('requests', {
  description: 'Count all incoming requests',
});

const handles = new Map();

export const countAllRequests = () => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!handles.has(req.path)) {
      const labels = { route: req.path };
      const handle = requestCount.bind(labels);
      handles.set(req.path, handle);
    }

    handles.get(req.path).add(1);
    next();
  };
};
```

Ensure prometheus is running by running the `prometheus` binary from earlier and start your application.

```sh
$ ts-node app.ts
prometheus scrape endpoint: http://localhost:9464/metrics
Listening for requests on http://localhost:8080
```

Now, each time you browse to <http://localhost:8080> you should see "Hello from the backend" in your browser and your metrics in prometheus should update. You can verify the current metrics by browsing to <http://localhost:9464/metrics>, which should look like this:

```sh
# HELP requests Count all incoming requests
# TYPE requests counter
requests{route="/"} 1
requests{route="/middle-tier"} 2
requests{route="/backend"} 4
```

You should also be able to see gathered metrics in your prometheus web UI.

<p align="center"><img src="../images/prometheus-graph.png?raw=true"/></p>
