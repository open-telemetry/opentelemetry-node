'use strict';

const benchmark = require('./benchmark');
const opentelemetry = require('../packages/opentelemetry-api');
const { BasicTracerProvider, BatchSpanProcessor, InMemorySpanExporter, SimpleSpanProcessor } = require('../packages/opentelemetry-sdk-base-tracing');

// Clear any previous global logger
opentelemetry.diag.setLogger();

const setups = [
  {
    name: 'NoopTracerProvider',
    provider: new opentelemetry.NoopTracerProvider()
  },
  {
    name: 'BasicTracerProvider',
    provider: new BasicTracerProvider()
  },
  {
    name: 'BasicTracerProvider with SimpleSpanProcessor',
    provider: getProvider(new SimpleSpanProcessor(new InMemorySpanExporter()))
  },
  {
    name: 'BasicTracerProvider with BatchSpanProcessor',
    provider: getProvider(new BatchSpanProcessor(new InMemorySpanExporter()))
  }
];

for (const setup of setups) {
  console.log(`Beginning ${setup.name} Benchmark...`);
  const tracer = setup.provider.getTracer("benchmark");
  const suite = benchmark(20)
    .add('#startSpan', function () {
      const span = tracer.startSpan('op');
      span.end();
    })
    .add('#startSpan:parent', function () {
      const span = tracer.startSpan('op');
      const childSpan = tracer.startSpan('client-op', { parent: span });
      childSpan.end();
      span.end();
    })
    .add('#startSpan with attribute', function () {
      const span = tracer.startSpan('op');
      span.setAttribute('attr-key-one', 'attr-value-one');
      span.end();
    })
    .add('#startSpan with 30 attributes', function () {
      const span = tracer.startSpan('op');
      for (let j = 0; j < 30; j++) {
        span.setAttribute('attr-key-' + j, 'attr-value-' + j);
      }
      span.end();
    })
    .add('#startSpan with 100 attributes', function () {
      const span = tracer.startSpan('op');
      for (let j = 0; j < 100; j++) {
        span.setAttribute('attr-key-' + j, 'attr-value-' + j);
      }
      span.end();
    });

  // run async
  suite.run({ async: false });
}
function getProvider(processor) {
  const provider = new BasicTracerProvider();
  provider.addSpanProcessor(processor);
  return provider;
}

