import { NodeTracerProvider } from '@opentelemetry/sdk-node-tracing';
const { Resource } = require('@opentelemetry/resources');
const { ResourceAttributes } = require('@opentelemetry/semantic-conventions');

import { SimpleSpanProcessor } from '@opentelemetry/sdk-base-tracing';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
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
