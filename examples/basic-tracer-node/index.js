'use strict';

const opentelemetry = require('@opentelemetry/api');
const { BasicTracerProvider, ConsoleSpanExporter, SimpleSpanProcessor } = require('@opentelemetry/tracing');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');

const provider = new BasicTracerProvider();

// Configure span processor to send spans to the exporter
const exporter = new JaegerExporter({
  serviceName: 'basic-service',
  endpoint: 'http://localhost:14268/api/traces',
});
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

/**
 * Initialize the OpenTelemetry APIs to use the BasicTracerProvider bindings.
 *
 * This registers the tracer provider with the OpenTelemetry API as the global
 * tracer provider. This means when you call API methods like
 * `opentelemetry.trace.getTracer`, they will use this tracer provider. If you
 * do not register a global tracer provider, instrumentation which calls these
 * methods will receive no-op implementations.
 */
provider.register();
const tracer = opentelemetry.trace.getTracer('example-basic-tracer-node');

// Create a span. A span must be closed.
const parentSpan = tracer.startSpan('main');
for (let i = 0; i < 10; i += 1) {
  doWork(parentSpan);
}
// Be sure to end the span.
parentSpan.end();

// flush and close the connection.
exporter.shutdown();

function doWork(parent) {
  // Start another span. In this example, the main method already started a
  // span, so that'll be the parent span, and this will be a child span.
  const ctx = opentelemetry.trace.setSpan(opentelemetry.context.active(), parent);
  const span = tracer.startSpan('doWork', undefined, ctx);

  // simulate some random work.
  for (let i = 0; i <= Math.floor(Math.random() * 40000000); i += 1) {
    // empty
  }

  // Set attributes to the span.
  span.setAttribute('key', 'value');

  // Annotate our span to capture metadata about our operation
  span.addEvent('invoking doWork');

  span.end();
}
