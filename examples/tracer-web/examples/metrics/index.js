'use strict';

const { DiagConsoleLogger, DiagLogLevel, diag } = require('@opentelemetry/api');
const { CollectorMetricExporter } = require('@opentelemetry/exporter-collector');
const { MeterProvider } = require('@opentelemetry/metrics');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// Optional and only needed to see the internal diagnostic logging (during development)
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const metricExporter = new CollectorMetricExporter();

let interval;
let meter;

function stopMetrics() {
  console.log('STOPPING METRICS');
  clearInterval(interval);
  meter.shutdown();
}

function startMetrics() {
  console.log('STARTING METRICS');
  meter = new MeterProvider({
    exporter: metricExporter,
    interval: 1000,
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'basic-metric-service',
    }),
  }).getMeter('example-exporter-collector');

  const requestCounter = meter.createCounter('requests', {
    description: 'Example of a Counter',
  });

  const upDownCounter = meter.createUpDownCounter('test_up_down_counter', {
    description: 'Example of a UpDownCounter',
  });

  const labels = { pid: process.pid, environment: 'staging' };

  interval = setInterval(() => {
    requestCounter.bind(labels).add(1);
    upDownCounter.bind(labels).add(Math.random() > 0.5 ? 1 : -1);
  }, 1000);
}

const addClickEvents = () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  startBtn.addEventListener('click', startMetrics);
  stopBtn.addEventListener('click', stopMetrics);
};

window.addEventListener('load', addClickEvents);
