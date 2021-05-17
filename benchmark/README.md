# Benchmarks

## How to run

To run your benchmark, just:

```sh
npm run bench
```

The minimum sample size is set to 10 to perform statistical analysis on benchmark, you can re-configure that in `benchmark.js`.

> NOTE: If you're interested in writing benchmark for other APIs, please write a benchmark in the `benchmark/index.js` module. Please refer to the `benchmark/tracer.js` or `benchmark/propagator.js` for more comprehensive examples.

## Results

### `v0.5.0` release

```text
Beginning NoopTracerProvider Benchmark...
  5 tests completed.

  #startSpan                     x 766,888,261 ops/sec ±1.81% (20 runs sampled)
  #startSpan:parent              x 755,332,363 ops/sec ±1.51% (20 runs sampled)
  #startSpan with attribute      x 765,932,668 ops/sec ±1.45% (20 runs sampled)
  #startSpan with 30 attributes  x   1,333,216 ops/sec ±10.66% (20 runs sampled)
  #startSpan with 100 attributes x     477,974 ops/sec ±3.66% (20 runs sampled)

Beginning BasicTracerProvider Benchmark...
  5 tests completed.

  #startSpan                     x 94,710 ops/sec ±19.20% (20 runs sampled)
  #startSpan:parent              x 62,938 ops/sec ±3.77% (20 runs sampled)
  #startSpan with attribute      x 93,389 ops/sec ±7.70% (20 runs sampled)
  #startSpan with 30 attributes  x 33,753 ops/sec ±8.07% (20 runs sampled)
  #startSpan with 100 attributes x  2,497 ops/sec ±14.78% (20 runs sampled)

Beginning BasicTracerProvider with SimpleSpanProcessor Benchmark...
  5 tests completed.

  #startSpan                     x 100,159 ops/sec ±7.17% (20 runs sampled)
  #startSpan:parent              x  63,848 ops/sec ±5.78% (20 runs sampled)
  #startSpan with attribute      x  96,301 ops/sec ±9.39% (20 runs sampled)
  #startSpan with 30 attributes  x  36,410 ops/sec ±2.21% (20 runs sampled)
  #startSpan with 100 attributes x   3,549 ops/sec ±3.33% (20 runs sampled)

Beginning BasicTracerProvider with BatchSpanProcessor Benchmark...
  5 tests completed.

  #startSpan                     x  90,992 ops/sec ±17.91% (20 runs sampled)
  #startSpan:parent              x  64,590 ops/sec ±4.18% (20 runs sampled)
  #startSpan with attribute      x 107,706 ops/sec ±2.21% (20 runs sampled)
  #startSpan with 30 attributes  x  24,199 ops/sec ±45.57% (20 runs sampled)
  #startSpan with 100 attributes x   2,645 ops/sec ±9.86% (20 runs sampled)

Beginning B3Propagator Benchmark...
  2 tests completed.

  #Inject  x 2,018,725 ops/sec ±3.49% (100 runs sampled)
  #Extract x 2,040,891 ops/sec ±1.75% (100 runs sampled)

Beginning HttpTraceContextPropagator Benchmark...
  2 tests completed.

  #Inject  x 3,987,007 ops/sec ±1.87% (100 runs sampled)
  #Extract x 1,792,743 ops/sec ±0.93% (100 runs sampled)
```

### `v0.3.3` release

```text
Beginning NoopTracerProvider Benchmark...
  5 tests completed.

  #startSpan                     x 731,516,636 ops/sec ±2.57% (20 runs sampled)
  #startSpan:parent              x 744,353,590 ops/sec ±3.03% (20 runs sampled)
  #startSpan with attribute      x 737,451,332 ops/sec ±3.75% (20 runs sampled)
  #startSpan with 30 attributes  x   1,658,688 ops/sec ±1.23% (20 runs sampled)
  #startSpan with 100 attributes x     535,082 ops/sec ±1.55% (20 runs sampled)

Beginning BasicTracerProvider Benchmark...
  5 tests completed.

  #startSpan                     x 80,633 ops/sec ±3.57% (20 runs sampled)
  #startSpan:parent              x 56,228 ops/sec ±2.18% (20 runs sampled)
  #startSpan with attribute      x 86,710 ops/sec ±1.80% (20 runs sampled)
  #startSpan with 30 attributes  x 36,331 ops/sec ±1.29% (20 runs sampled)
  #startSpan with 100 attributes x  3,549 ops/sec ±3.59% (20 runs sampled)

Beginning BasicTracerProvider with SimpleSpanProcessor Benchmark...
  5 tests completed.

  #startSpan                     x 74,539 ops/sec ±4.49% (20 runs sampled)
  #startSpan:parent              x 48,953 ops/sec ±4.98% (20 runs sampled)
  #startSpan with attribute      x 79,686 ops/sec ±2.54% (20 runs sampled)
  #startSpan with 30 attributes  x 26,491 ops/sec ±13.68% (20 runs sampled)
  #startSpan with 100 attributes x  2,464 ops/sec ±19.64% (20 runs sampled)

Beginning BasicTracerProvider with BatchSpanProcessor Benchmark...
  5 tests completed.

  #startSpan                     x 74,974 ops/sec ±3.57% (20 runs sampled)
  #startSpan:parent              x 42,390 ops/sec ±20.68% (20 runs sampled)
  #startSpan with attribute      x 76,497 ops/sec ±2.93% (20 runs sampled)
  #startSpan with 30 attributes  x 33,042 ops/sec ±2.03% (20 runs sampled)
  #startSpan with 100 attributes x  3,459 ops/sec ±4.56% (20 runs sampled)


Beginning B3Propagator Benchmark...
  2 tests completed.

  #Inject  x 5,086,366 ops/sec ±3.18% (100 runs sampled)
  #Extract x 4,859,557 ops/sec ±3.80% (100 runs sampled)

Beginning HttpTraceContextPropagator Benchmark...
  2 tests completed.

  #Inject  x 13,660,710 ops/sec ±1.84% (100 runs sampled)
  #Extract x  1,692,010 ops/sec ±0.83% (100 runs sampled)
```
