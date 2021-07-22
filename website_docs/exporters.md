---
title: "Exporters"
weight: 3
---

In order to visualize and analyze your traces, you will need to export them to a tracing backend such as Jaeger or Zipkin.
OpenTelemetry JS provides exporters for some common open source tracing backends.

Below you will find some introductions on how to setup backends and the matching exporters.

## Jaeger

To set up Jaeger as quickly as possible, run it in a docker container:

```shell
$ docker run -d --name jaeger \
  -e COLLECTOR_ZIPKIN_HOST_PORT=:9411 \
  -p 5775:5775/udp \
  -p 6831:6831/udp \
  -p 6832:6832/udp \
  -p 5778:5778 \
  -p 16686:16686 \
  -p 14268:14268 \
  -p 14250:14250 \
  -p 9411:9411 \
  jaegertracing/all-in-one:latest
```

Install the exporter package as a dependency for your application:

```shell
npm install --save @opentelemetry/exporter-jaeger
```

Update your opentelemetry configuration to use the exporter and to send data to your jaeger backend:

```javascript
const { JaegerExporter } = require("@opentelemetry/exporter-jaeger");
const { BatchSpanProcessor } = require("@opentelemetry/tracing");

provider.addSpanProcessor(new BatchSpanProcessor(new JaegerExporter()))
```

## Zipkin

To set up Zipkin as quickly as possible, run it in a docker container:

```shell
docker run --rm -d -p 9411:9411 --name zipkin openzipkin/zipkin
```

Install the exporter package as a dependency for your application:

```shell
npm install --save @opentelemetry/exporter-zipkin
```

Update your opentelemetry configuration to use the exporter and to send data to your zipkin backend:

```javascript
const { ZipkinExporter } = require("@opentelemetry/exporter-zipkin");
const { BatchSpanProcessor } = require("@opentelemetry/tracing");

provider.addSpanProcessor(new BatchSpanProcessor(new ZipkinExporter()))
```

## OpenTelemetry Collector

If you are looking for a vendor-agnostic way to receive, process and export your
telemetry data follow the instructions to setup a [OpenTelemetry collector](https://opentelemetry.io/docs/collector/)
