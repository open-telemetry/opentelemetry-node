"use strict";
 
const { MeterProvider } = require('@opentelemetry/sdk-base-metrics');
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

