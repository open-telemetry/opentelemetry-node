'use strict';

const api = require('@opentelemetry/api');
const tracer = require('./tracer')('example-grpc-client');
// eslint-disable-next-line import/order
const grpc = require('grpc');
const messages = require('./helloworld_pb');
const services = require('./helloworld_grpc_pb');

const PORT = 50051;

/** A function which makes requests and handles response. */
function main() {
  // span corresponds to outgoing requests. Here, we have manually created
  // the span, which is created to track work that happens outside of the
  // request lifecycle entirely.
  const span = tracer.startSpan('client.js:main()');
  api.context.with(api.trace.setSpan(api.context.active(), span), () => {
    console.log('Client traceId ', span.spanContext().traceId);
    const client = new services.GreeterClient(
      `localhost:${PORT}`,
      grpc.credentials.createInsecure(),
    );
    const request = new messages.HelloRequest();
    let user;
    if (process.argv.length >= 3) {
      // eslint-disable-next-line prefer-destructuring
      user = process.argv[2];
    } else {
      user = 'world';
    }
    request.setName(user);
    client.sayHello(request, (err, response) => {
      span.end();
      if (err) throw err;
      console.log('Greeting:', response.getMessage());
    });
  });

  // The process must live for at least the interval past any traces that
  // must be exported, or some risk being lost if they are recorded after the
  // last export.
  console.log('Sleeping 5 seconds before shutdown to ensure all records are flushed.');
  setTimeout(() => { console.log('Completed.'); }, 5000);
}

main();
