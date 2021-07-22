---
title: "Instrumentation Examples"
weight: 4
---

Here are Some of the resources for Opentelemetry Instrumentation Examples

## Core Examples

The repository of the [JavaScript version of OpenTelemetry](https://github.com/svrnm/opentelemetry-js) holds some
[examples](https://github.com/svrnm/opentelemetry-js/tree/main/examples) of how to run real application with OpenTelemetry JavaScript.

## Plugin & Package Examples

Many of the packages and plugins at the [repository for OpenTelemetry JavaScript](https://github.com/open-telemetry/opentelemetry-js-contrib/)
contributions come with an usage example. You can find them in the [examples folder](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/examples).

## Community Resources

### nodejs-opentelemetry-tempo

Project demonstrating Complete Observability Stack utilizing [Prometheus](https://prometheus.io/), [Loki](https://grafana.com/oss/loki/) (_For distributed logging_), [Tempo](https://grafana.com/oss/tempo/) (_For Distributed tracing, this basically uses Jaeger Internally_), [Grafana](https://grafana.com/grafana/) for **NodeJs** based applications (_With OpenTelemetry auto / manual Instrumentation_) involving microservices with DB interactions.

Checkout [nodejs-opentelemetry-tempo](https://github.com/mnadeem/nodejs-opentelemetry-tempo) and get started

```bash
docker-compose up --build
```
