'use strict';

const { ResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { Resource } = require('@opentelemetry/resources');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { NodeTracerProvider } = require('@opentelemetry/node');
const { SimpleSpanProcessor } = require('@opentelemetry/tracing');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin');
const { TracerShim } = require('@opentelemetry/shim-opentracing');

function shim(serviceName) {
  const provider = new NodeTracerProvider({
    resource: new Resource({ [ResourceAttributes.SERVICE_NAME]: serviceName }),
  });

  provider.addSpanProcessor(new SimpleSpanProcessor(getExporter(serviceName)));
  // Initialize the OpenTelemetry APIs to use the NodeTracerProvider bindings
  provider.register();

  registerInstrumentations({});

  return new TracerShim(provider.getTracer('opentracing-shim'));
}

function getExporter() {
  const type = process.env.EXPORTER.toLowerCase() || 'jaeger';

  if (type.startsWith('z')) {
    return new ZipkinExporter();
  }

  return new JaegerExporter();
}

exports.shim = shim;
