const opentelemetry = require('@opentelemetry/core');
const { BasicTracerProvider, BatchSpanProcessor, SimpleSpanProcessor } = require('@opentelemetry/tracing');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin');
const { CollectorExporter } =  require('@opentelemetry/exporter-collector');

const provider = new BasicTracerProvider();

const zipkinExporter = new ZipkinExporter({serviceName: 'basic-service'});
const jaegerExporter = new JaegerExporter({
  serviceName: 'basic-service',
});
const collectorExporter = new CollectorExporter({serviceName: 'basic-service'});

// It is recommended to use this BatchSpanProcessor for better performance
// and optimization, especially in production.
provider.addSpanProcessor(new BatchSpanProcessor(zipkinExporter, {
  bufferSize: 10 // This is added for example, default size is 100.
}));

// It is recommended to use SimpleSpanProcessor in case of Jaeger exporter as
// it's internal client already handles the spans with batching logic.
provider.addSpanProcessor(new SimpleSpanProcessor(jaegerExporter));

provider.addSpanProcessor(new SimpleSpanProcessor(collectorExporter));

// Initialize the OpenTelemetry APIs to use the BasicTracerProvider bindings
opentelemetry.initGlobalTracerProvider(provider);
const tracer = opentelemetry.getTracer('default');

// Create a span. A span must be closed.
const span = tracer.startSpan('main');
for (let i = 0; i < 10; i++) {
  doWork(span);
}
// Be sure to end the span.
span.end();

// flush and close the connection.
zipkinExporter.shutdown();
jaegerExporter.shutdown();
collectorExporter.shutdown();

function doWork(parent) {
  // Start another span. In this example, the main method already started a
  // span, so that'll be the parent span, and this will be a child span.
  const span = tracer.startSpan('doWork', {
    parent: parent
  });

  // simulate some random work.
  for (let i = 0; i <= Math.floor(Math.random() * 40000000); i++) { }

  // Set attributes to the span.
  span.setAttribute('key', 'value');

  // Annotate our span to capture metadata about our operation
  span.addEvent('invoking doWork').end();
}
