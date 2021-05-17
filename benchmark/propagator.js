'use strict';

const benchmark = require('./benchmark');
const opentelemetry = require('../packages/opentelemetry-core');
const api = require('../packages/opentelemetry-api');
const { Context } = require('../packages/opentelemetry-context-base');
const { B3Propagator } = require('../packages/opentelemetry-propagator-b3');

const setups = [
  {
    name: 'B3Propagator',
    propagator: new B3Propagator(),
    injectCarrier: {},
    extractCarrier: {
      'x-b3-traceid': 'd4cda95b652f4a1592b449d5929fda1b',
      'x-b3-spanid': '6e0c63257de34c92'
    }
  },
  {
    name: 'HttpTraceContextPropagator',
    propagator: new opentelemetry.HttpTraceContextPropagator(),
    injectCarrier: {},
    extractCarrier: {
      traceparent: '00-d4cda95b652f4a1592b449d5929fda1b-6e0c63257de34c92-00'
    }
  }
];

for (const setup of setups) {
  console.log(`Beginning ${setup.name} Benchmark...`);
  const propagator = setup.propagator;
  const suite = benchmark(100)
    .add('#Inject', function () {
      propagator.inject(
        api.setExtractedSpanContext(Context.ROOT_CONTEXT, {
          traceId: 'd4cda95b652f4a1592b449d5929fda1b',
          spanId: '6e0c63257de34c92'
        }), setup.injectCarrier, api.defaultTextMapSetter);
    })
    .add('#Extract', function () {
      propagator.extract(Context.ROOT_CONTEXT, setup.extractCarrier, api.defaultTextMapGetter);
    });

  // run async
  suite.run({ async: false });
}
