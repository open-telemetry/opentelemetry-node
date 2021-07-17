'use strict';

const { MeterProvider } = require('@opentelemetry/sdk-base-metrics');
const { DiagConsoleLogger, DiagLogLevel, diag } = require('@opentelemetry/api');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');

// Optional and only needed to see the internal diagnostic logging (during development)
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const exporter = new PrometheusExporter(
  {
    startServer: true,
  },
  () => {
    console.log(
      `prometheus scrape endpoint: http://localhost:${PrometheusExporter.DEFAULT_OPTIONS.port}${PrometheusExporter.DEFAULT_OPTIONS.endpoint}`,
    );
  },
);

const meter = new MeterProvider({
  exporter,
  interval: 2000,
}).getMeter('example-observer');

meter.createValueObserver('cpu_core_usage', {
  description: 'Example of a sync value observer with callback',
}, async (observerResult) => { // this callback is called once per each interval
  await new Promise((resolve) => {
    setTimeout(()=> {resolve()}, 50);
  });
  observerResult.observe(getRandomValue(), { core: '1' });
  observerResult.observe(getRandomValue(), { core: '2' });
});

// no callback as they will be updated in batch observer
const tempMetric = meter.createValueObserver('cpu_temp_per_app', {
  description: 'Example of sync value observer used with async batch observer',
});

// no callback as they will be updated in batch observer
const cpuUsageMetric = meter.createValueObserver('cpu_usage_per_app', {
  description: 'Example of sync value observer used with async batch observer',
});

meter.createBatchObserver((observerBatchResult) => {
    Promise.all([
      someAsyncMetrics(),
      // simulate waiting
      new Promise((resolve, reject) => {
        setTimeout(resolve, 300);
      }),
    ]).then(([apps, waiting]) => {
      apps.forEach(app => {
        observerBatchResult.observe({ app: app.name, core: '1' }, [
          tempMetric.observation(app.core1.temp),
          cpuUsageMetric.observation(app.core1.usage),
        ]);
        observerBatchResult.observe({ app: app.name, core: '2' }, [
          tempMetric.observation(app.core2.temp),
          cpuUsageMetric.observation(app.core2.usage),
        ]);
      });
    });
  }, {
    maxTimeoutUpdateMS: 500,
  },
);

function someAsyncMetrics() {
  return new Promise((resolve) => {
    setTimeout(() => {
      const stats = [
        {
          name: 'app1',
          core1: { usage: getRandomValue(), temp: getRandomValue() * 100 },
          core2: { usage: getRandomValue(), temp: getRandomValue() * 100 },
        },
        {
          name: 'app2',
          core1: { usage: getRandomValue(), temp: getRandomValue() * 100 },
          core2: { usage: getRandomValue(), temp: getRandomValue() * 100 },
        },
      ];
      resolve(stats);
    }, 200);
  });
}

function getRandomValue() {
  return Math.random();
}
