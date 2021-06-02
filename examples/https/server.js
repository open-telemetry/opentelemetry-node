'use strict';

const api = require('@opentelemetry/api');
// eslint-disable-next-line import/order
const tracer = require('./tracer')('example-https-server');
const fs = require('fs');
const https = require('https');

/** Starts a HTTPs server that receives requests on sample server port. */
function startServer(port) {
  const options = {
    key: fs.readFileSync('./server-key.pem'),
    cert: fs.readFileSync('./server-cert.pem'),
  };
  // Creates a server
  const server = https.createServer(options, handleRequest);
  // Starts the server
  server.listen(port, (err) => {
    if (err) {
      throw err;
    }
    console.log(`Node HTTPs listening on ${port}`);
  });
}

/** A function which handles requests and send response. */
function handleRequest(request, response) {
  const currentSpan = api.trace.getSpan(api.context.active());
  // display traceid in the terminal
  console.log(`traceid: ${currentSpan.spanContext().traceId}`);
  const span = tracer.startSpan('handleRequest', {
    kind: 1, // server
    attributes: { key: 'value' },
  });
  // Annotate our span to capture metadata about the operation
  span.addEvent('invoking handleRequest');

  const body = [];
  request.on('error', (err) => console.log(err));
  request.on('data', (chunk) => body.push(chunk));
  request.on('end', () => {
    // deliberately sleeping to mock some action.
    setTimeout(() => {
      span.end();
      response.end('Hello World!');
    }, 2000);
  });
}

startServer(443);
