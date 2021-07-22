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

export const countAllRequests = () => (req: Request, _res: Response, next: NextFunction): void => {
  if (!handles.has(req.path)) {
    const labels = { route: req.path };
    const handle = requestCount.bind(labels);
    handles.set(req.path, handle);
  }

  handles.get(req.path).add(1);
  next();
};
