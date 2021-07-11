# Overview

OpenTelemetry metrics allow a user to collect data and export it to a metrics backend like Prometheus.

This is a simple example that demonstrates basic metrics collection and exports those metrics to a Prometheus compatible endpoint.

## Installation

```sh
# from this directory
npm install
```

Setup [Prometheus](https://prometheus.io/docs/prometheus/latest/getting_started/)

## Run the Application

- Run the server

```sh
# from this directory
npm run start
```

- Replace the `prometheus.yml` provided by the Prometheus installation with the following:

```yaml
global:
  scrape_interval: 15s # Default is every 1 minute.

scrape_configs:
  - job_name: 'opentelemetry'
    # metrics_path defaults to '/metrics'
    # scheme defaults to 'http'.
    static_configs:
    - targets: ['localhost:9464']

```

- Start Prometheus

```sh
# from the directory you downloaded prometheus
prometheus --config.file=prometheus.yml
```

### Prometheus UI

If you are using the default configurations, the prometheus client will be available at <http://localhost:9090>

<p align="center"><img src="images/prom-counter.png?raw=true"/></p>
<p align="center"><img src="images/prom-updowncounter.png?raw=true"/></p>

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more information on OpenTelemetry metrics, visit: <https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-base-metrics>
- For more information on OpenTelemetry for Node.js, visit: <https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-node-tracing>

## LICENSE

Apache License 2.0
