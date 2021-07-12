---
title: "Node.JS"
weight: 2
---

This guide will show you how to get started with tracing in Node.js.

- [Example Application](#example-application)
  - [Dependencies](#dependencies)
  - [Code](#code)
- [Tracing](#tracing)
  - [Dependencies](#dependencies-1)
    - [Core Dependencies](#core-dependencies)
    - [Exporter](#exporter)
    - [Instrumentation Modules](#instrumentation-modules)
  - [Setup](#setup)
  - [Run Application](#run-application)

## Example Application

This is a small example application we will monitor in this guide.

### Dependencies

Install dependencies used by the example.

```sh
npm install express
```

### Code

Please save the following code as `app.js`.

```javascript
/* app.js */

const express = require("express");

const PORT = process.env.PORT || "8080";
const app = express();

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.listen(parseInt(PORT, 10), () => {
  console.log(`Listening for requests on http://localhost:${PORT}`);
});
```

Run the application with the following request and open <http://localhost:8080> in your web browser to ensure it is working.

```sh
$ node app.js
Listening for requests on http://localhost:8080
```

## Tracing

### Dependencies

The following dependencies are required to trace a Node.js application.

#### Core Dependencies

These dependencies are required to configure the tracing SDK and create spans.

- `@opentelemetry/api`
- `@opentelemetry/node`
- `@opentelemetry/tracing`

#### Exporter

In order to visualize and analyze your traces, you will need to export them to a tracing backend such as Jaeger. OpenTelemetry JS provides exporters for some common open source tracing backends.

- Jaeger - `@opentelemetry/exporter-jaeger`
- Zipkin - `@opentelemetry/exporter-zipkin`
- OpenTelemetry Protocol
  - GRPC - `@opentelemetry/exporter-collector-grpc`
  - Protobuf/HTTP - `@opentelemetry/exporter-collector-proto`
  - JSON/HTTP - `@opentelemetry/exporter-collector`

#### Instrumentation Modules

Many common modules such as the `http` standard library module, `express`, and others can be automatically instrumented using autoinstrumentation modules. To find autoinstrumenatation modules, you can look at the [registry](https://opentelemetry.io/registry/?language=js&component=instrumentation#).

You can also install all instrumentations maintained by the OpenTelemetry authors by using the `@opentelemetry/auto-instrumentations-node` module.

### Setup

The tracing setup and configuration should be run before your application code. One tool commonly used for this task is the [`-r, --require module`](https://nodejs.org/api/cli.html#cli_r_require_module) flag.

Create a file with a name like `tracing.js` which will contain your tracing setup code. In this example, we will use the `ConsoleSpanExporter` which prints all spans to the console. In your application, you should use the exporter which goes with the tracing backend of your choice. You may also want to use the `BatchSpanProcessor` to export spans in batches in order to more efficiently use resources.

```javascript
/* tracing.js */

// Require dependencies
const { NodeTracerProvider } = require("@opentelemetry/node");
const { SimpleSpanProcessor, ConsoleSpanExporter } = require("@opentelemetry/tracing");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');

// Create a tracer provider
const provider = new NodeTracerProvider();

// The exporter handles sending spans to your tracing backend
const exporter = new ConsoleSpanExporter();

// The simple span processor sends spans to the exporter as soon as they are ended.
const processor = new SimpleSpanProcessor(exporter);
provider.addSpanProcessor(processor);

// The provider must be registered in order to
// be used by the OpenTelemetry API and instrumentations
provider.register();

// This will automatically enable all instrumentations
registerInstrumentations({
  instrumentations: [getNodeAutoInstrumentations()],
});
```

### Run Application

First, install the dependencies as described above. Here you need to add the following:

```shell
npm install --save @opentelemetry/node @opentelemetry/auto-instrumentations-node
```

Now you can run your application as you normally would, but you can use the `--require` flag to load the tracing code before the application code.

```shell
$ node --require './tracing.js' app.js
Listening for requests on http://localhost:8080
```

Now, when you open <http://localhost:8080> in your web browser, you should see the spans printed in the console by the `ConsoleSpanExporter`.

<details>
<summary>View example output</summary>

```json
{
  "traceId": "3f1fe6256ea46d19ec3ca97b3409ad6d",
  "parentId": "f0b7b340dd6e08a7",
  "name": "middleware - query",
  "id": "41a27f331c7bfed3",
  "kind": 0,
  "timestamp": 1624982589722992,
  "duration": 417,
  "attributes": {
    "http.route": "/",
    "express.name": "query",
    "express.type": "middleware"
  },
  "status": { "code": 0 },
  "events": []
}
{
  "traceId": "3f1fe6256ea46d19ec3ca97b3409ad6d",
  "parentId": "f0b7b340dd6e08a7",
  "name": "middleware - expressInit",
  "id": "e0ed537a699f652a",
  "kind": 0,
  "timestamp": 1624982589725778,
  "duration": 673,
  "attributes": {
    "http.route": "/",
    "express.name": "expressInit",
    "express.type": "middleware"
  },
  "status": { code: 0 },
  "events": []
}
{
  "traceId": "3f1fe6256ea46d19ec3ca97b3409ad6d",
  "parentId": "f0b7b340dd6e08a7",
  "name": "request handler - /",
  "id": "8614a81e1847b7ef",
  "kind": 0,
  "timestamp": 1624982589726941,
  "duration": 21,
  "attributes": {
    "http.route": "/",
    "express.name": "/",
    "express.type": "request_handler"
  },
  "status": { code: 0 },
  "events": []
}
{
  "traceId": "3f1fe6256ea46d19ec3ca97b3409ad6d",
  "parentId": undefined,
  "name": "GET /",
  "id": "f0b7b340dd6e08a7",
  "kind": 1,
  "timestamp": 1624982589720260,
  "duration": 11380,
  "attributes": {
    "http.url": "http://localhost:8080/",
    "http.host": "localhost:8080",
    "net.host.name": "localhost",
    "http.method": "GET",
    "http.route": "",
    "http.target": "/",
    "http.user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
    "http.flavor": "1.1",
    "net.transport": "ip_tcp",
    "net.host.ip": "::1",
    "net.host.port": 8080,
    "net.peer.ip": "::1",
    "net.peer.port": 61520,
    "http.status_code": 304,
    "http.status_text": "NOT MODIFIED"
  },
  "status": { "code": 1 },
  "events": []
}
```

</details>
