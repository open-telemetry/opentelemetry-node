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

import { BaggageEntry, BaggageEntryMetadata } from './Entry';

/**
 * Baggage represents collection of key-value pairs with optional metadata.
 * Each key of Baggage is associated with exactly one value.
 * Baggage may be used to annotate and enrich telemetry data.
 */
export interface Baggage {
  /**
   * Get an entry from Baggage if it exists
   *
   * @param key The key which identifies the BaggageEntry
   */
  getEntry(key: string): BaggageEntry | undefined;

  /**
   * Get a list of all entries in the Baggage
   */
  getAllEntries(): BaggageEntry[];

  /**
   * Create a new Baggage from this baggage with a new entry.
   *
   * @param key string which identifies the baggage entry
   * @param value string value of the baggage
   * @param metadata optional entry metadata
   */
  setEntry(
    key: string,
    value: string,
    metadata?: BaggageEntryMetadata
  ): Baggage;

  /**
   * Create a new baggage containing all entries from this except the removed entry
   *
   * @param key key identifying the entry to be removed
   */
  removeEntry(key: string): Baggage;
}
