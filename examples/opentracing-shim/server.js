'use strict';

const http = require('http');
const opentracing = require('opentracing');
const utils = require('./utils');
const shim = require('./shim').shim('http_server_opentracing');

opentracing.initGlobalTracer(shim);
const tracer = opentracing.globalTracer();

startServer(3000);

function startServer(port) {
  const server = http.createServer(handleRequest);

  server.listen(port, (err) => {
    if (err) throw err;

    console.log(`Server is listening on ${port}`);
  });
}

async function handleRequest(req, res) {
  const parentSpan = tracer.extract(
    opentracing.FORMAT_HTTP_HEADERS,
    req.headers,
  );

  const span = tracer.startSpan('handle_request', {
    childOf: parentSpan,
  });

  span.setTag('custom', 'tag value');
  span.setTag('alpha', '1000');

  await doSomething(span);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.write(
    JSON.stringify({ status: 'OK', traceId: span.spanContext().toTraceId() }),
  );

  res.end();
  span.finish();
}

async function doSomething(parentSpan) {
  const span = tracer.startSpan('do_something', { childOf: parentSpan });

  span.setTag('alpha', '200');
  span.setTag('beta', '50');
  span.log({ state: 'waiting' });

  // deliberately sleeping to mock some action.
  await utils.sleep(1000);

  span.finish();
}
