# Overview

This example shows how to use [@opentelemetry/sdk-base-tracing](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-base-tracing) to instrument a simple Node.js application - e.g. a batch job.

Our example will export spans data simultaneously on `Console` and [Jaeger](https://www.jaegertracing.io), however you can run your code anywhere and can use any exporter that OpenTelemetry supports.

## Installation

```sh
# from this directory
npm install
```

(Optional) Setup [Jaeger Tracing](https://www.jaegertracing.io/docs/latest/getting-started/#all-in-one): needs to be running on `localhost` port `16686`.

## Run the Application

```sh
# from this directory
npm start
```

### Jaeger UI

Open the Jaeger UI in your browser [http://localhost:16686](http://localhost:16686)

<p align="center"><img src="images/jaeger-ui-list.png?raw=true"/></p>

Select `basic-service` under *Service Name* and click on *Find Traces*.

Click on the trace to view its details.

<p align="center"><img src="./images/jaeger-ui-detail.png?raw=true"/></p>

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more information on tracing, visit: <https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-base-tracing>

## LICENSE

Apache License 2.0

[opentelemetry-collector-url]: https://github.com/open-telemetry/opentelemetry-exporter-collector
