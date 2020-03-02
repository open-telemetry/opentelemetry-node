'use strict';

const { MeterProvider } = require('@opentelemetry/metrics');
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
  interval: 1000,
}).getMeter('example-observer');

const otelCpuUsage = meter.createObserver('metric_observer', {
  monotonic: false,
  labelKeys: ['pid', 'core'],
  description: 'Example of a observer',
});

function getCpuUsage() {
  return Math.random();
}

otelCpuUsage.setCallback((observerResult) => {
  observerResult.observe(getCpuUsage, meter.labels({ pid: process.pid, core: '1' }));
  observerResult.observe(getCpuUsage, meter.labels({ pid: process.pid, core: '2' }));
  observerResult.observe(getCpuUsage, meter.labels({ pid: process.pid, core: '3' }));
  observerResult.observe(getCpuUsage, meter.labels({ pid: process.pid, core: '4' }));
});
