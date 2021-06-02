'use strict';
import { context, trace } from '@opentelemetry/api';
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/tracing';
import { CollectorTraceExporter } from '@opentelemetry/exporter-collector';
import { WebTracerProvider } from '@opentelemetry/web';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { B3Propagator } from '@opentelemetry/propagator-b3';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

const provider = new WebTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
provider.addSpanProcessor(new SimpleSpanProcessor(new CollectorTraceExporter()));
provider.register({
  contextManager: new ZoneContextManager(),
  propagator: new B3Propagator(),
});

registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      ignoreUrls: [/localhost:8090\/sockjs-node/],
      propagateTraceHeaderCorsUrls: [
        'https://cors-test.appspot.com/test',
        'https://httpbin.org/get',
      ],
      clearTimingResources: true,
    }),
  ],
});

const webTracerWithZone = provider.getTracer('example-tracer-web');

const getData = (url) => fetch(url, {
  method: 'GET',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// example of keeping track of context between async operations
const prepareClickEvent = () => {
  const url = 'https://httpbin.org/get';

  const element = document.getElementById('button1');

  const onClick = () => {
    const singleSpan = webTracerWithZone.startSpan(`files-series-info`);
    context.with(trace.setSpan(context.active(), singleSpan), () => {
      getData(url).then((_data) => {
        trace.getSpan(context.active()).addEvent('fetching-single-span-completed');
        singleSpan.end();
      });
    });
    for (let i = 0, j = 5; i < j; i += 1) {
      const span = webTracerWithZone.startSpan(`files-series-info-${i}`);
      context.with(trace.setSpan(context.active(), span), () => {
        getData(url).then((_data) => {
          trace.getSpan(context.active()).addEvent(`fetching-span-${i}-completed`);
          span.end();
        });
      });
    }
  };
  element.addEventListener('click', onClick);
};

window.addEventListener('load', prepareClickEvent);
