# Processor API Guide

[The processor](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-base-metrics/src/export/Processor.ts?rgh-link-date=2020-05-25T18%3A43%3A57Z) has two responsibilities: choosing which aggregator to choose for a metric instrument and store the last record for each metric ready to be exported.

## Selecting a specific aggregator for metrics

Sometimes you may want to use a specific aggregator for one of your metric, export an average of the last X values instead of just the last one.

Here is what an aggregator that does that would look like:

```ts
import { Aggregator } from '@opentelemetry/sdk-base-metrics';
import { hrTime } from '@opentelemetry/core';

export class AverageAggregator implements Aggregator {

  private _values: number[] = [];
  private _limit: number;

  constructor (limit?: number) {
    this._limit = limit ?? 10;
  }

  update (value: number) {
    this._values.push(value);
    if (this._values.length >= this._limit) {
      this._values = this._values.slice(0, 10);
    }
  }

  toPoint() {
    const sum =this._values.reduce((agg, value) => {
      agg += value;
      return agg;
    }, 0);
    return {
      value: this._values.length > 0 ? sum / this._values.length : 0,
      timestamp: hrTime(),
    }
  }
}
```

Now we will need to implement our own processor to configure the sdk to use our new aggregator. To simplify even more, we will just extend the `UngroupedProcessor` (which is the default) to avoid re-implementing the whole `Aggregator` interface.

Here the result:

```ts
import {
  UngroupedProcessor,
  MetricDescriptor,
  CounterSumAggregator,
  ObserverAggregator,
  MeasureExactAggregator,
} from '@opentelemetry/sdk-base-metrics';

export class CustomProcessor extends UngroupedProcessor {
  aggregatorFor (metricDescriptor: MetricDescriptor) {
    if (metricDescriptor.name === 'requests') {
      return new AverageAggregator(10);
    }
    // this is exactly what the "UngroupedProcessor" does, we will re-use it
    // to fallback on the default behavior
    switch (metricDescriptor.metricKind) {
      case MetricKind.COUNTER:
        return new CounterSumAggregator();
      case MetricKind.OBSERVER:
        return new ObserverAggregator();
      default:
        return new MeasureExactAggregator();
    }
  }
}
```

Finally, we need to specify to the `MeterProvider` to use our `CustomProcessor` when creating new meter:

```ts
import {
  UngroupedProcessor,
  MetricDescriptor,
  CounterSumAggregator,
  ObserverAggregator,
  MeasureExactAggregator,
  MeterProvider,
  Aggregator,
} from '@opentelemetry/sdk-base-metrics';
import { hrTime } from '@opentelemetry/core';

export class AverageAggregator implements Aggregator {

  private _values: number[] = [];
  private _limit: number;

  constructor (limit?: number) {
    this._limit = limit ?? 10;
  }

  update (value: number) {
    this._values.push(value);
    if (this._values.length >= this._limit) {
      this._values = this._values.slice(0, 10);
    }
  }

  toPoint() {
    const sum =this._values.reduce((agg, value) => {
      agg += value;
      return agg;
    }, 0);
    return {
      value: this._values.length > 0 ? sum / this._values.length : 0,
      timestamp: hrTime(),
    }
  }
}

export class CustomProcessor extends UngroupedProcessor {
  aggregatorFor (metricDescriptor: MetricDescriptor) {
    if (metricDescriptor.name === 'requests') {
      return new AverageAggregator(10);
    }
    // this is exactly what the "UngroupedProcessor" does, we will re-use it
    // to fallback on the default behavior
    switch (metricDescriptor.metricKind) {
      case MetricKind.COUNTER:
        return new CounterSumAggregator();
      case MetricKind.OBSERVER:
        return new ObserverAggregator();
      default:
        return new MeasureExactAggregator();
    }
  }
}

const meter = new MeterProvider({
  processor: new CustomProcessor(),
  interval: 1000,
}).getMeter('example-custom-processor');

const requestsLatency = meter.createValueRecorder('requests', {
  monotonic: true,
  description: 'Average latency'
});
```
