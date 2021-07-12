---
title: "Instrumentation"
weight: 3
---

This guide will cover creating and annotating spans, creating and annotating metrics, how to pass context, and a guide to automatic instrumentation for JavaScript. This simple example works in the browser as well as with Node.JS

In the following this guide will use the following sample app:

```javascript
'use strict';

for (let i = 0; i < 10; i += 1) {
  doWork();
}

function doWork() {
  console.log("work...")
  // simulate some random work.
  for (let i = 0; i <= Math.floor(Math.random() * 40000000); i += 1) {
  }
}
```

## Creating Spans

As you have learned in the previous [Getting Started](../getting_started/) guide you need a TracerProvider and an Exporter. Install the dependencies and add them to head of your application code to get started:

```shell
npm install @opentelemetry/tracing
```

```javascript
const { BasicTracerProvider, ConsoleSpanExporter, SimpleSpanProcessor } = require('@opentelemetry/tracing');

const provider = new BasicTracerProvider();

// Configure span processor to send spans to the exporter
provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

provider.register();
```

Next, initialize the OpenTelemetry APIs to use the BasicTracerProvider bindings.
This registers the tracer provider with the OpenTelemetry API as the global tracer provider.
This means when you call API methods like `opentelemetry.trace.getTracer`, they will use this tracer provider.
If you do not register a global tracer provider, instrumentation which calls these methods will receive no-op implementations

Install the required package and modify your code:

```shell
npm install @opentelemetry/api
```

```javascript
const opentelemetry = require('@opentelemetry/api');
const tracer = opentelemetry.trace.getTracer('example-basic-tracer-node');
```

Add a first span to the sample application. Modify your code like the following:

```javascript
// Create a span. A span must be closed.
const parentSpan = tracer.startSpan('main');
for (let i = 0; i < 10; i += 1) {
  doWork(parentSpan);
}
// Be sure to end the span.
parentSpan.end();
```

Run your application and you will see traces being exported to the console:

```json
{
  "traceId": "833bac85797c7ace581235446c4c769a",
  "parentId": undefined,
  "name": "main",
  "id": "5c82d9e39d58229e",
  "kind": 0,
  "timestamp": 1603790966012813,
  "duration": 13295,
  "attributes": {},
  "status": { "code": 0 },
  "events": []
}
```

Add further spans into the `doWork` method:

```javascript
// Create a span. A span must be closed.
const parentSpan = tracer.startSpan('main');
for (let i = 0; i < 10; i += 1) {
  doWork(parentSpan);
}

/* ... */

function doWork(parent) {
  // Start another span. In this example, the main method already started a
  // span, so that'll be the parent span, and this will be a child span.
  const span = tracer.startSpan('doWork', {
    parent,
  });

  // simulate some random work.
  for (let i = 0; i <= Math.floor(Math.random() * 40000000); i += 1) {
    // empty
  }
  span.end();
}
```

Invoking your application once again will give you a list of traces being exported.

## Attributes

Attributes can be used to describe your spans. Attributes can be added to a span at any time before the span is finished:

```javascript
function doWork(parent) {
  const span = tracer.startSpan('doWork', {
    parent, attributes: { attribute1 : 'value1' }
  });
  for (let i = 0; i <= Math.floor(Math.random() * 40000000); i += 1) {
    // empty
  }
  span.setAttribute('attribute2', 'value2');
  span.end();
}
```

### Semantic Attributes

There are semantic conventions for spans representing operations in well-known protocols like HTTP or database calls. Semantic conventions for these spans are defined in the specification at [Trace Semantic Conventions](https://github.com/open-telemetry/opentelemetry-specification/tree/main/specification/trace/semantic_conventions). In the simple example of this guide the source code attributes can be used.

First add the semantic conventions as a dependency to your application:

```shell
npm install --save @opentelemetry/semantic-conventions
```

Add the following to the top of your application file:

```javascript
const { SemanticAttributes } = require('@opentelemetry/semantic-conventions');
```

Finally, you can update your file to include semantic attributes:

```javascript
function doWork(parent) {
  const span = tracer.startSpan('doWork', {
    parent, attributes: { SemanticAttributes.CODE_FUNCTION : 'doWork' }
  });
  for (let i = 0; i <= Math.floor(Math.random() * 40000000); i += 1) {
    // empty
  }
  span.setAttribute(SemanticAttributes.CODE_FILEPATH, __filename);
  span.end();
}
```
