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

import { collectorTypes } from "@opentelemetry/exporter-collector";
import { ReadableSpan } from "@opentelemetry/tracing";

import * as assert from "assert";
import { CollectorExporterNodeBase } from "../src/CollectorExporterNodeBase";
import { CollectorExporterConfigNode, ServiceClientType } from "../src/types";
import { mockedReadableSpan } from "./helper";

class MockCollectorExporter extends CollectorExporterNodeBase<
  ReadableSpan,
  ReadableSpan[]
> {
  /**
   * Callbacks passed to _send()
   */
  sendCallbacks: {
    onSuccess: () => void;
    onError: (error: collectorTypes.CollectorExporterError) => void;
  }[] = [];

  getDefaultUrl(config: CollectorExporterConfigNode): string {
    return "";
  }

  getDefaultServiceName(config: CollectorExporterConfigNode): string {
    return "";
  }

  convert(spans: ReadableSpan[]): ReadableSpan[] {
    return spans;
  }

  getServiceClientType() {
    return ServiceClientType.SPANS;
  }

  getServiceProtoPath(): string {
    return "opentelemetry/proto/collector/trace/v1/trace_service.proto";
  }
}

// Mocked _send which just saves the callbacks for later
MockCollectorExporter.prototype["_send"] = function _sendMock(
  self: MockCollectorExporter,
  objects: ReadableSpan[],
  onSuccess: () => void,
  onError: (error: collectorTypes.CollectorExporterError) => void
): void {
  self.sendCallbacks.push({ onSuccess, onError });
};

describe("CollectorExporterNodeBase", () => {
  let exporter: MockCollectorExporter;
  const concurrencyLimit = 5;

  beforeEach((done) => {
    exporter = new MockCollectorExporter({ concurrencyLimit });
    done();
  });

  describe("export", () => {
    it("should export requests concurrently", async () => {
      const spans = [Object.assign({}, mockedReadableSpan)];
      const numToExport = concurrencyLimit;

      for (let i = 0; i < numToExport; ++i) {
        exporter.export(spans, () => {});
      }

      assert.strictEqual(exporter["_sendingPromises"].length, numToExport);
      const promisesAllDone = Promise.all(exporter["_sendingPromises"]);
      // Mock that all requests finish sending
      exporter.sendCallbacks.forEach(({ onSuccess }) => onSuccess());

      // All finished promises should be popped off
      await promisesAllDone;
      assert.strictEqual(exporter["_sendingPromises"].length, 0);
    });

    it("should drop new export requests when already sending at concurrencyLimit", async () => {
      const spans = [Object.assign({}, mockedReadableSpan)];
      const numToExport = concurrencyLimit + 5;

      for (let i = 0; i < numToExport; ++i) {
        exporter.export(spans, () => {});
      }

      assert.strictEqual(exporter["_sendingPromises"].length, concurrencyLimit);
      const promisesAllDone = Promise.all(exporter["_sendingPromises"]);
      // Mock that all requests finish sending
      exporter.sendCallbacks.forEach(({ onSuccess }) => onSuccess());

      // All finished promises should be popped off
      await promisesAllDone;
      assert.strictEqual(exporter["_sendingPromises"].length, 0);
    });

    it("should pop export request promises even if they failed", async () => {
      const spans = [Object.assign({}, mockedReadableSpan)];

      exporter.export(spans, () => {});
      assert.strictEqual(exporter["_sendingPromises"].length, 1);
      const promisesAllDone = Promise.all(exporter["_sendingPromises"]);
      // Mock that all requests fail sending
      exporter.sendCallbacks.forEach(({ onError }) =>
        onError(new Error("Failed to send!!"))
      );

      // All finished promises should be popped off
      await promisesAllDone;
      assert.strictEqual(exporter["_sendingPromises"].length, 0);
    });

    it("should pop export request promises even if success callback throws error", async () => {
      const spans = [Object.assign({}, mockedReadableSpan)];

      exporter["_sendPromise"](
        spans,
        () => {
          throw new Error("Oops");
        },
        () => {}
      );

      assert.strictEqual(exporter["_sendingPromises"].length, 1);
      const promisesAllDone = Promise.all(exporter["_sendingPromises"])
        // catch expected unhandled exception
        .catch(() => {});

      // Mock that the request finishes sending
      exporter.sendCallbacks.forEach(({ onSuccess }) => {
        onSuccess();
      });

      // All finished promises should be popped off
      await promisesAllDone;
      assert.strictEqual(exporter["_sendingPromises"].length, 0);
    });
  });
});
