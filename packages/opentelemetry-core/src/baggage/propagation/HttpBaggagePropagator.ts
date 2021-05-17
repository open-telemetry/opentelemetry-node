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

import {
  Context,
  BaggageEntry,
  getBaggage,
  setBaggage,
  TextMapGetter,
  TextMapPropagator,
  TextMapSetter,
  createBaggage,
  isInstrumentationSuppressed,
} from '@opentelemetry/api';
import { getKeyPairs, serializeKeyPairs, parsePairKeyValue } from '../utils';
import {
  BAGGAGE_MAX_NAME_VALUE_PAIRS,
  BAGGAGE_ITEMS_SEPARATOR,
  BAGGAGE_HEADER,
  BAGGAGE_MAX_PER_NAME_VALUE_PAIRS,
} from '../constants';

/**
 * Propagates {@link Baggage} through Context format propagation.
 *
 * Based on the Baggage specification:
 * https://w3c.github.io/baggage/
 */
export class HttpBaggagePropagator implements TextMapPropagator {
  inject(context: Context, carrier: unknown, setter: TextMapSetter) {
    const baggage = getBaggage(context);
    if (!baggage || isInstrumentationSuppressed(context)) return;
    const keyPairs = getKeyPairs(baggage)
      .filter((pair: string) => {
        return pair.length <= BAGGAGE_MAX_PER_NAME_VALUE_PAIRS;
      })
      .slice(0, BAGGAGE_MAX_NAME_VALUE_PAIRS);
    const headerValue = serializeKeyPairs(keyPairs);
    if (headerValue.length > 0) {
      setter.set(carrier, BAGGAGE_HEADER, headerValue);
    }
  }

  extract(context: Context, carrier: unknown, getter: TextMapGetter): Context {
    const headerValue: string = getter.get(carrier, BAGGAGE_HEADER) as string;
    if (!headerValue) return context;
    const baggage: Record<string, BaggageEntry> = {};
    if (headerValue.length === 0) {
      return context;
    }
    const pairs = headerValue.split(BAGGAGE_ITEMS_SEPARATOR);
    pairs.forEach(entry => {
      const keyPair = parsePairKeyValue(entry);
      if (keyPair) {
        const baggageEntry: BaggageEntry = { value: keyPair.value };
        if (keyPair.metadata) {
          baggageEntry.metadata = keyPair.metadata;
        }
        baggage[keyPair.key] = baggageEntry;
      }
    });
    if (Object.entries(baggage).length === 0) {
      return context;
    }
    return setBaggage(context, createBaggage(baggage));
  }

  fields(): string[] {
    return [BAGGAGE_HEADER];
  }
}
