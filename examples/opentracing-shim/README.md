# Overview

OpenTracing shim allows existing OpenTracing instrumentation to report to OpenTelemetry.

This is a simple example that demonstrates how existing OpenTracing instrumentation can be integrated with OpenTelemetry.

The example shows key aspects of tracing such as

- Root Span (on client)
- Child Span from a remote parent (on server)
- Span Tag
- Span Log
- Make a shim between OpenTracing and OpenTelemetry tracers

## Installation

```sh
# from this directory
$ npm install
```

## Run the Application

### Zipkin

- Setup [Zipkin Tracing UI](https://zipkin.io/pages/quickstart.html)

- Run the server

```sh
# from this directory
$ npm run zipkin:server
```

- Run the client

```sh
# from this directory
$ npm run zipkin:client
```

- Check trace

  `zipkin:client` should output the `traceId` in the terminal.

  Go to Zipkin with your browser <http://localhost:9411/zipkin/traces/(your-trace-id)> (e.g <http://localhost:9411/zipkin/traces/4815c3d576d930189725f1f1d1bdfcc6)>

<p align="center"><img src="./images/zipkin-ui.png?raw=true"/></p>

### Jaeger

- Setup [Jaeger Tracing UI](https://www.jaegertracing.io/docs/latest/getting-started/#all-in-one)

- Run the server

```sh
# from this directory
$ npm run jaeger:server
```

- Run the client

```sh
# from this directory
$ npm run jaeger:client
```

- Check trace

  `jaeger:client` should output the `traceId` in the terminal.

  Go to Jaeger with your browser <http://localhost:16686/trace/(your-trace-id)> (e.g <http://localhost:16686/trace/4815c3d576d930189725f1f1d1bdfcc6)>

<p align="center"><img src="images/jaeger-ui.png?raw=true"/></p>

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more information on OpenTelemetry for Node.js, visit: <https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-node-tracing>
- For more information on OpenTracing, visit: <https://opentracing.io/>

## LICENSE

Apache License 2.0
