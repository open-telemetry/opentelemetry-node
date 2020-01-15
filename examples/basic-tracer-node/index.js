const opentelemetry = require('@opentelemetry/core');
const { BasicTracerProvider, SimpleSpanProcessor } = require('@opentelemetry/tracing');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin');
const { CollectorExporter } =  require('@opentelemetry/exporter-collector');

const options = {
  serviceName: 'basic-service'
};

// Initialize an exporter depending on how we were started
let exporter;

const EXPORTER = process.env.EXPORTER || '';
if (EXPORTER.toLowerCase().startsWith('z')) {
  exporter = new ZipkinExporter(options);
} else if (EXPORTER.toLowerCase().startsWith('j')) {
  exporter = new JaegerExporter(options);
} else {
  exporter = new CollectorExporter(options);
}

const provider = new BasicTracerProvider();

// Configure span processor to send spans to the provided exporter
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

// Initialize the OpenTelemetry APIs to use the BasicTracerProvider bindings
opentelemetry.initGlobalTracerProvider(provider);
const tracer = opentelemetry.getTracer('example-basic-tracer-node')

// Create a span. A span must be closed.
const span = tracer.startSpan('main');
for (let i = 0; i < 10; i++) {
  doWork(span);
}
// Be sure to end the span.
span.end();

// flush and close the connection.
exporter.shutdown();

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
