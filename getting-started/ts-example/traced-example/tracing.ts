import { NodeTracerProvider } from '@opentelemetry/node';

import { SimpleSpanProcessor } from '@opentelemetry/tracing';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';

const { Resource } = require('@opentelemetry/resources');
const { ResourceAttributes } = require('@opentelemetry/semantic-conventions');
// For Jaeger, use the following line instead:
// import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');

const provider: NodeTracerProvider = new NodeTracerProvider({
  resource: new Resource({
    [ResourceAttributes.SERVICE_NAME]: 'getting-started',
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
