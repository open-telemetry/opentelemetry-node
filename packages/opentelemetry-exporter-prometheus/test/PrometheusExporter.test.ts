/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ObserverResult } from '@opentelemetry/api-metrics';
import {
  CounterMetric,
  SumAggregator,
  Meter,
  MeterProvider,
  LastValueAggregator,
  HistogramAggregator,
} from '@opentelemetry/sdk-base-metrics';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as http from 'http';
import { PrometheusExporter } from '../src';
import { mockAggregator, mockedHrTimeMs } from './util';
import { SinonStubbedInstance } from 'sinon';

describe('PrometheusExporter', () => {
  mockAggregator(SumAggregator);
  mockAggregator(LastValueAggregator);
  mockAggregator(HistogramAggregator);

  afterEach(() => {
    delete process.env.OTEL_EXPORTER_PROMETHEUS_HOST;
    delete process.env.OTEL_EXPORTER_PROMETHEUS_PORT;
  });

  describe('constructor', () => {
    it('should construct an exporter', done => {
      const exporter = new PrometheusExporter();
      assert.ok(typeof exporter.startServer === 'function');
      assert.ok(typeof exporter.shutdown === 'function');
      exporter.shutdown().then(done);
    });

    it('should start the server by default and call the callback', done => {
      const port = PrometheusExporter.DEFAULT_OPTIONS.port;
      const endpoint = PrometheusExporter.DEFAULT_OPTIONS.endpoint;
      const exporter = new PrometheusExporter({}, () => {
        const url = `http://localhost:${port}${endpoint}`;
        http.get(url, (res: any) => {
          assert.strictEqual(res.statusCode, 200);
          exporter.shutdown().then(() => {
            return done();
          });
        });
      });
    });

    it('should not start the server if preventServerStart is passed as an option', () => {
      const exporter = new PrometheusExporter({ preventServerStart: true });
      assert.ok(exporter['_server'].listening === false);
    });
  });

  describe('server', () => {
    it('should start on startServer() and call the callback', done => {
      const exporter = new PrometheusExporter({
        port: 9722,
        preventServerStart: true,
      });
      exporter.startServer().then(() => {
        exporter.shutdown().then(() => {
          return done();
        });
      });
    });

    it('should listen on the default port and default endpoint', done => {
      const port = PrometheusExporter.DEFAULT_OPTIONS.port;
      const endpoint = PrometheusExporter.DEFAULT_OPTIONS.endpoint;
      const exporter = new PrometheusExporter({}, () => {
        const url = `http://localhost:${port}${endpoint}`;
        http.get(url, (res: any) => {
          assert.strictEqual(res.statusCode, 200);
          exporter.shutdown().then(() => {
            return done();
          });
        });
      });
    });

    it('should listen on a custom port and endpoint if provided', done => {
      const port = 9991;
      const endpoint = '/metric';

      const exporter = new PrometheusExporter(
        {
          port,
          endpoint,
        },
        () => {
          const url = `http://localhost:${port}${endpoint}`;
          http.get(url, (res: any) => {
            assert.strictEqual(res.statusCode, 200);
            exporter.shutdown().then(() => {
              return done();
            });
          });
        }
      );
    });

    it('should listen on environmentally set host and port', () => {
      process.env.OTEL_EXPORTER_PROMETHEUS_HOST = '127.0.0.1';
      process.env.OTEL_EXPORTER_PROMETHEUS_PORT = '1234';
      const exporter = new PrometheusExporter({}, async () => {
        await exporter.shutdown();
      });
      assert.strictEqual(exporter['_host'], '127.0.0.1');
      assert.strictEqual(exporter['_port'], 1234);
    });

    it('should not require endpoints to start with a slash', done => {
      const port = 9991;
      const endpoint = 'metric';

      const exporter = new PrometheusExporter(
        {
          port,
          endpoint,
        },
        () => {
          const url = `http://localhost:${port}/metric`;
          http.get(url, (res: any) => {
            assert.strictEqual(res.statusCode, 200);
            exporter.shutdown().then(() => {
              const exporter2 = new PrometheusExporter(
                {
                  port,
                  endpoint: `/${endpoint}`,
                },
                () => {
                  const url = `http://localhost:${port}/metric`;
                  http.get(url, (res: any) => {
                    assert.strictEqual(res.statusCode, 200);
                    exporter2.stopServer().then(() => {
                      return done();
                    });
                  });
                }
              );
            });
          });
        }
      );
    });

    it('should return a HTTP status 404 if the endpoint does not match', done => {
      const port = 9912;
      const endpoint = '/metrics';
      const exporter = new PrometheusExporter(
        {
          port,
          endpoint,
        },
        () => {
          const url = `http://localhost:${port}/invalid`;

          http.get(url, (res: any) => {
            assert.strictEqual(res.statusCode, 404);
            exporter.shutdown().then(() => {
              return done();
            });
          });
        }
      );
    });

    it('should call a provided callback on shutdown regardless of if the server is running', done => {
      const exporter = new PrometheusExporter({ preventServerStart: true });
      exporter.shutdown().then(() => {
        return done();
      });
    });

    it('should able to call getMetricsRequestHandler function to generate response with metrics', () => {
      const exporter = new PrometheusExporter({ preventServerStart: true });
      const mockRequest: SinonStubbedInstance<http.IncomingMessage> = sinon.createStubInstance(
        http.IncomingMessage
      );
      const mockResponse: SinonStubbedInstance<http.ServerResponse> = sinon.createStubInstance(
        http.ServerResponse
      );
      exporter.getMetricsRequestHandler(
        (mockRequest as unknown) as http.IncomingMessage,
        (mockResponse as unknown) as http.ServerResponse
      );
      sinon.assert.calledOnce(mockResponse.setHeader);
      sinon.assert.calledOnce(mockResponse.end);
      assert.strictEqual(mockResponse.statusCode, 200);
    });
  });

  describe('export', () => {
    let exporter: PrometheusExporter;
    let meterProvider: MeterProvider;
    let meter: Meter;

    beforeEach(done => {
      exporter = new PrometheusExporter({}, () => {
        meterProvider = new MeterProvider({
          interval: Math.pow(2, 31) - 1,
        });
        meter = meterProvider.getMeter('test-prometheus', '1', {
          exporter,
        });
        done();
      });
    });

    afterEach(done => {
      exporter.shutdown().then(done);
    });

    it('should export a count aggregation', done => {
      const counter = meter.createCounter('counter_total', {
        description: 'a test description',
      });

      const boundCounter = counter.bind({ key1: 'labelValue1' });
      boundCounter.add(10);
      meter.collect().then(() => {
        exporter.export(meter.getProcessor().checkPointSet(), () => {
          // TODO: Remove this special case once the PR is ready.
          // This is to test the special case where counters are destroyed
          // and recreated in the exporter in order to get around prom-client's
          // aggregation and use ours.
          boundCounter.add(10);
          exporter.export(meter.getProcessor().checkPointSet(), () => {
            http
              .get('http://localhost:9464/metrics', res => {
                res.on('data', chunk => {
                  const body = chunk.toString();
                  const lines = body.split('\n');

                  assert.strictEqual(
                    lines[0],
                    '# HELP counter_total a test description'
                  );

                  assert.deepStrictEqual(lines, [
                    '# HELP counter_total a test description',
                    '# TYPE counter_total counter',
                    `counter_total{key1="labelValue1"} 20 ${mockedHrTimeMs}`,
                    '',
                  ]);

                  done();
                });
              })
              .on('error', errorHandler(done));
          });
        });
      });
    });

    it('should export an observer aggregation', done => {
      function getCpuUsage() {
        return 0.999;
      }

      meter.createValueObserver(
        'metric_observer',
        {
          description: 'a test description',
        },
        (observerResult: ObserverResult) => {
          observerResult.observe(getCpuUsage(), {
            pid: String(123),
            core: '1',
          });
        }
      );

      meter.collect().then(() => {
        exporter.export(meter.getProcessor().checkPointSet(), () => {
          exporter.export(meter.getProcessor().checkPointSet(), () => {
            http
              .get('http://localhost:9464/metrics', res => {
                res.on('data', chunk => {
                  const body = chunk.toString();
                  const lines = body.split('\n');

                  assert.deepStrictEqual(lines, [
                    '# HELP metric_observer a test description',
                    '# TYPE metric_observer gauge',
                    `metric_observer{pid="123",core="1"} 0.999 ${mockedHrTimeMs}`,
                    '',
                  ]);
                  done();
                });
              })
              .on('error', errorHandler(done));
          });
        });
      });
    });

    it('should export multiple labels', done => {
      const counter = meter.createCounter('counter_total', {
        description: 'a test description',
      }) as CounterMetric;

      counter.bind({ counterKey1: 'labelValue1' }).add(10);
      counter.bind({ counterKey1: 'labelValue2' }).add(20);
      meter.collect().then(() => {
        exporter.export(meter.getProcessor().checkPointSet(), () => {
          http
            .get('http://localhost:9464/metrics', res => {
              res.on('data', chunk => {
                const body = chunk.toString();
                const lines = body.split('\n');

                assert.deepStrictEqual(lines, [
                  '# HELP counter_total a test description',
                  '# TYPE counter_total counter',
                  `counter_total{counterKey1="labelValue1"} 10 ${mockedHrTimeMs}`,
                  `counter_total{counterKey1="labelValue2"} 20 ${mockedHrTimeMs}`,
                  '',
                ]);

                done();
              });
            })
            .on('error', errorHandler(done));
        });
      });
    });

    it('should export multiple labels on manual shutdown', done => {
      const counter = meter.createCounter('counter_total', {
        description: 'a test description',
      }) as CounterMetric;

      counter.bind({ counterKey1: 'labelValue1' }).add(10);
      counter.bind({ counterKey1: 'labelValue2' }).add(20);
      counter.bind({ counterKey1: 'labelValue3' }).add(30);
      meterProvider.shutdown().then(() => {
        http
          .get('http://localhost:9464/metrics', res => {
            res.on('data', chunk => {
              const body = chunk.toString();
              const lines = body.split('\n');

              assert.deepStrictEqual(lines, [
                '# HELP counter_total a test description',
                '# TYPE counter_total counter',
                `counter_total{counterKey1="labelValue1"} 10 ${mockedHrTimeMs}`,
                `counter_total{counterKey1="labelValue2"} 20 ${mockedHrTimeMs}`,
                `counter_total{counterKey1="labelValue3"} 30 ${mockedHrTimeMs}`,
                '',
              ]);

              done();
            });
          })
          .on('error', errorHandler(done));
      });
    });

    it('should export a comment if no metrics are registered', done => {
      exporter.export([], () => {
        http
          .get('http://localhost:9464/metrics', res => {
            res.on('data', chunk => {
              const body = chunk.toString();
              const lines = body.split('\n');

              assert.deepStrictEqual(lines, ['# no registered metrics']);

              done();
            });
          })
          .on('error', errorHandler(done));
      });
    });

    it('should add a description if missing', done => {
      const counter = meter.createCounter('counter_total');

      const boundCounter = counter.bind({ key1: 'labelValue1' });
      boundCounter.add(10);
      meter.collect().then(() => {
        exporter.export(meter.getProcessor().checkPointSet(), () => {
          http
            .get('http://localhost:9464/metrics', res => {
              res.on('data', chunk => {
                const body = chunk.toString();
                const lines = body.split('\n');

                assert.deepStrictEqual(lines, [
                  '# HELP counter_total description missing',
                  '# TYPE counter_total counter',
                  `counter_total{key1="labelValue1"} 10 ${mockedHrTimeMs}`,
                  '',
                ]);

                done();
              });
            })
            .on('error', errorHandler(done));
        });
      });
    });

    it('should sanitize names', done => {
      const counter = meter.createCounter('counter.bad-name');
      const boundCounter = counter.bind({ key1: 'labelValue1' });
      boundCounter.add(10);
      meter.collect().then(() => {
        exporter.export(meter.getProcessor().checkPointSet(), () => {
          http
            .get('http://localhost:9464/metrics', res => {
              res.on('data', chunk => {
                const body = chunk.toString();
                const lines = body.split('\n');

                assert.deepStrictEqual(lines, [
                  '# HELP counter_bad_name_total description missing',
                  '# TYPE counter_bad_name_total counter',
                  `counter_bad_name_total{key1="labelValue1"} 10 ${mockedHrTimeMs}`,
                  '',
                ]);

                done();
              });
            })
            .on('error', errorHandler(done));
        });
      });
    });

    it('should export a UpDownCounter as a gauge', done => {
      const counter = meter.createUpDownCounter('counter', {
        description: 'a test description',
      });

      counter.bind({ key1: 'labelValue1' }).add(20);
      meter.collect().then(() => {
        exporter.export(meter.getProcessor().checkPointSet(), () => {
          http
            .get('http://localhost:9464/metrics', res => {
              res.on('data', chunk => {
                assert.deepStrictEqual(chunk.toString().split('\n'), [
                  '# HELP counter a test description',
                  '# TYPE counter gauge',
                  `counter{key1="labelValue1"} 20 ${mockedHrTimeMs}`,
                  '',
                ]);

                done();
              });
            })
            .on('error', errorHandler(done));
        });
      });
    });

    it('should export a SumObserver as a counter', done => {
      function getValue() {
        return 20;
      }

      meter.createSumObserver(
        'sum_observer',
        {
          description: 'a test description',
        },
        (observerResult: ObserverResult) => {
          observerResult.observe(getValue(), {
            key1: 'labelValue1',
          });
        }
      );

      meter.collect().then(() => {
        exporter.export(meter.getProcessor().checkPointSet(), () => {
          http
            .get('http://localhost:9464/metrics', res => {
              res.on('data', chunk => {
                const body = chunk.toString();
                const lines = body.split('\n');

                assert.deepStrictEqual(lines, [
                  '# HELP sum_observer a test description',
                  '# TYPE sum_observer gauge',
                  `sum_observer{key1="labelValue1"} 20 ${mockedHrTimeMs}`,
                  '',
                ]);
              });

              done();
            })
            .on('error', errorHandler(done));
        });
      });
    });

    it('should export a UpDownSumObserver as a gauge', done => {
      function getValue() {
        return 20;
      }

      meter.createUpDownSumObserver(
        'updown_observer',
        {
          description: 'a test description',
        },
        (observerResult: ObserverResult) => {
          observerResult.observe(getValue(), {
            key1: 'labelValue1',
          });
        }
      );

      meter.collect().then(() => {
        exporter.export(meter.getProcessor().checkPointSet(), () => {
          http
            .get('http://localhost:9464/metrics', res => {
              res.on('data', chunk => {
                const body = chunk.toString();
                const lines = body.split('\n');

                assert.deepStrictEqual(lines, [
                  '# HELP updown_observer a test description',
                  '# TYPE updown_observer gauge',
                  `updown_observer{key1="labelValue1"} 20 ${mockedHrTimeMs}`,
                  '',
                ]);
              });

              done();
            })
            .on('error', errorHandler(done));
        });
      });
    });

    it('should export a ValueRecorder as a summary', done => {
      const valueRecorder = meter.createValueRecorder('value_recorder', {
        description: 'a test description',
      });

      valueRecorder.bind({ key1: 'labelValue1' }).record(20);

      meter.collect().then(() => {
        exporter.export(meter.getProcessor().checkPointSet(), () => {
          http
            .get('http://localhost:9464/metrics', res => {
              res.on('data', chunk => {
                const body = chunk.toString();
                const lines = body.split('\n');

                assert.deepStrictEqual(lines, [
                  '# HELP value_recorder a test description',
                  '# TYPE value_recorder histogram',
                  `value_recorder_count{key1="labelValue1"} 1 ${mockedHrTimeMs}`,
                  `value_recorder_sum{key1="labelValue1"} 20 ${mockedHrTimeMs}`,
                  `value_recorder_bucket{key1="labelValue1",le="+Inf"} 1 ${mockedHrTimeMs}`,
                  '',
                ]);

                done();
              });
            })
            .on('error', errorHandler(done));
        });
      });
    });
  });

  describe('configuration', () => {
    let meter: Meter;
    let counter: CounterMetric;
    let exporter: PrometheusExporter | undefined;

    beforeEach(() => {
      meter = new MeterProvider().getMeter('test-prometheus');
      counter = meter.createCounter('counter') as CounterMetric;
      counter.bind({ key1: 'labelValue1' }).add(10);
    });

    afterEach(done => {
      if (exporter) {
        exporter.shutdown().then(done);
        exporter = undefined;
      } else {
        done();
      }
    });

    it('should use a configured name prefix', done => {
      exporter = new PrometheusExporter(
        {
          prefix: 'test_prefix',
        },
        async () => {
          await meter.collect();
          exporter!.export(meter.getProcessor().checkPointSet(), () => {
            http
              .get('http://localhost:9464/metrics', res => {
                res.on('data', chunk => {
                  const body = chunk.toString();
                  const lines = body.split('\n');

                  assert.deepStrictEqual(lines, [
                    '# HELP test_prefix_counter_total description missing',
                    '# TYPE test_prefix_counter_total counter',
                    `test_prefix_counter_total{key1="labelValue1"} 10 ${mockedHrTimeMs}`,
                    '',
                  ]);

                  done();
                });
              })
              .on('error', errorHandler(done));
          });
        }
      );
    });

    it('should use a configured port', done => {
      exporter = new PrometheusExporter(
        {
          port: 8080,
        },
        async () => {
          await meter.collect();
          exporter!.export(meter.getProcessor().checkPointSet(), () => {
            http
              .get('http://localhost:8080/metrics', res => {
                res.on('data', chunk => {
                  const body = chunk.toString();
                  const lines = body.split('\n');

                  assert.deepStrictEqual(lines, [
                    '# HELP counter_total description missing',
                    '# TYPE counter_total counter',
                    `counter_total{key1="labelValue1"} 10 ${mockedHrTimeMs}`,
                    '',
                  ]);

                  done();
                });
              })
              .on('error', errorHandler(done));
          });
        }
      );
    });

    it('should use a configured endpoint', done => {
      exporter = new PrometheusExporter(
        {
          endpoint: '/test',
        },
        async () => {
          await meter.collect();
          exporter!.export(meter.getProcessor().checkPointSet(), () => {
            http
              .get('http://localhost:9464/test', res => {
                res.on('data', chunk => {
                  const body = chunk.toString();
                  const lines = body.split('\n');

                  assert.deepStrictEqual(lines, [
                    '# HELP counter_total description missing',
                    '# TYPE counter_total counter',
                    `counter_total{key1="labelValue1"} 10 ${mockedHrTimeMs}`,
                    '',
                  ]);

                  done();
                });
              })
              .on('error', errorHandler(done));
          });
        }
      );
    });

    it('should export a metric without timestamp', done => {
      exporter = new PrometheusExporter(
        {
          appendTimestamp: false,
        },
        async () => {
          await meter.collect();
          exporter!.export(meter.getProcessor().checkPointSet(), () => {
            http
              .get('http://localhost:9464/metrics', res => {
                res.on('data', chunk => {
                  const body = chunk.toString();
                  const lines = body.split('\n');

                  assert.deepStrictEqual(lines, [
                    '# HELP counter_total description missing',
                    '# TYPE counter_total counter',
                    'counter_total{key1="labelValue1"} 10',
                    '',
                  ]);

                  done();
                });
              })
              .on('error', errorHandler(done));
          });
        }
      );
    });
  });
});

function errorHandler(done: Mocha.Done): (err: Error) => void {
  return err => done(err);
}
