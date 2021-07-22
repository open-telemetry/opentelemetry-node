---
title: "Browser"
weight: 2
---

This guide uses the example application in HTML & javascript provided below, but the steps to instrument your own application should be broadly the same.

- [Example Application](#example-application)
  - [Installation](#installation)
  - [Initialization and Configuration](#initialization-and-configuration)
  - [Creating a Tracer Provider](#creating-a-tracer-provider)
  - [Creating an Exporter](#creating-an-exporter)
  - [Add Plugins](#add-plugins)
- [Meta Packages for Web](#meta-packages-for-web)
- [Instrumentation with Browser Extension](#instrumentation-with-browser-extension)

## Example Application

This is a very simple guide, if you'd like to see more complex examples go to [examples/tracer-web](https://github.com/open-telemetry/opentelemetry-js/tree/main/examples/tracer-web)

Copy the following file into an empty directory and call it `index.html`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Document Load Instrumentation Example</title>
  <base href="/">
  <!--
    https://www.w3.org/TR/trace-context/
    Set the `traceparent` in the server's HTML template code. It should be
    dynamically generated server side to have the server's request trace Id,
    a parent span Id that was set on the server's request span, and the trace
    flags to indicate the server's sampling decision
    (01 = sampled, 00 = notsampled).
    '{version}-{traceId}-{spanId}-{sampleDecision}'
  -->
  <meta name="traceparent" content="00-ab42124a3c573678d4d8b21ba52df3bf-d21f7bc17caa5aba-01">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  Example of using Web Tracer with document load instrumentation with console exporter and collector exporter
</body>
</html>
```

### Installation

To create traces in the browser, you will need `@opentelemetry/web`, and the instrumentation `@opentelemetry/instrumentation-document-load`:

```shell
npm init -y
npm install --save @opentelemetry/web @opentelemetry/instrumentation-document-load @opentelemetry/context-zone
```

### Initialization and Configuration

Create a empty file called `document-load.js` and add the following code to your html right before the body end tag:

```html
<script type="text/javascript" src="document-load.js"></script>
```

We will add some code that will trace the document load timings and output those as OpenTelemetry Spans.

### Creating a Tracer Provider

Add the following code to the `document-load.js` to create a tracer provider, which brings the instrumentaion to trace document load:

```javascript
import { WebTracerProvider } from '@opentelemetry/web';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

const provider = new WebTracerProvider();

provider.register({
  // Changing default contextManager to use ZoneContextManager - supports asynchronous operations - optional
  contextManager: new ZoneContextManager(),
});

// Registering instrumentations
registerInstrumentations({
  instrumentations: [
    new DocumentLoadInstrumentation(),
  ],
});
```

In the following we will use [parcel](https://parceljs.org/) as web application bundler, but you can of course also use any other build tool.

Run

```shell
npx parcel index.html
```

and open the development webserver (e.g. at `http://localhost:1234`) to see if your code works.

There will be no output of traces yet, for this we need to add an exporter

### Creating an Exporter

In the following example, we will use the `ConsoleSpanExporter` which prints all spans to the console.

In order to visualize and analyze your traces, you will need to export them to a tracing backend.
Follow [these instructions](../exporters.md) for setting up a backend and exporter.

You may also want to use the `BatchSpanProcessor` to export spans in batches in order to more efficiently use resources.

To export traces to the console, modify `document-load.js` so that it matches the following code snippet:

```javascript
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/tracing';
import { WebTracerProvider } from '@opentelemetry/web';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

const provider = new WebTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

provider.register({
  // Changing default contextManager to use ZoneContextManager - supports asynchronous operations - optional
  contextManager: new ZoneContextManager(),
});

// Registering instrumentations
registerInstrumentations({
  instrumentations: [
    new DocumentLoadInstrumentation(),
  ],
});
```

Now, rebuild your application and open the browser again. In the console of the developer toolbar you should see some traces being exporterd:

```json
{
  "traceId": "ab42124a3c573678d4d8b21ba52df3bf",
  "parentId": "cfb565047957cb0d",
  "name": "documentFetch",
  "id": "5123fc802ffb5255",
  "kind": 0,
  "timestamp": 1606814247811266,
  "duration": 9390,
  "attributes": {
    "component": "document-load",
    "http.response_content_length": 905
  },
  "status": {
    "code": 0
  },
  "events": [
    {
      "name": "fetchStart",
      "time": [
        1606814247,
        811266158
      ]
    },
    {
      "name": "domainLookupStart",
      "time": [
        1606814247,
        811266158
      ]
    },
    {
      "name": "domainLookupEnd",
      "time": [
        1606814247,
        811266158
      ]
    },
    {
      "name": "connectStart",
      "time": [
        1606814247,
        811266158
      ]
    },
    {
      "name": "connectEnd",
      "time": [
        1606814247,
        811266158
      ]
    },
    {
      "name": "requestStart",
      "time": [
        1606814247,
        819101158
      ]
    },
    {
      "name": "responseStart",
      "time": [
        1606814247,
        819791158
      ]
    },
    {
      "name": "responseEnd",
      "time": [
        1606814247,
        820656158
      ]
    }
  ]
}
```

### Add Plugins

If you want to instrument AJAX requests, User Interactions and others, you can add plugins to your
instrumentation:

```javascript
registerInstrumentations({
  instrumentations: [
    new UserInteractionInstrumentation(),
    new XMLHttpRequestInstrumentation()
  ],
});
```

## Meta Packages for Web

To leverage the most common instrumentations all in one you can simply use the
[OpenTelemetry Meta Packages for Web](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-web)

## Instrumentation with Browser Extension

If you'd like to quickly preview what OpenTelemetry instrumentation would look like with your website (or any other site)
installed, you can use the [OpenTelemetry Browser Extension](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/opentelemetry-browser-extension-autoinjection)
