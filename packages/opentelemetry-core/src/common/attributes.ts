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
import { AttributeValue, Attributes } from '@opentelemetry/api';

export function sanitizeAttributes(attributes: unknown): Attributes {
  const out: Attributes = {};

  if (attributes == null || typeof attributes !== 'object') {
    return out;
  }

  for (const [k, v] of Object.entries(attributes!)) {
    if (isAttributeValue(v)) {
      if (Array.isArray(v)) {
        out[k] = v.slice();
      } else {
        out[k] = v;
      }
    }
  }

  return out;
}

export function isAttributeValue(val: unknown): val is AttributeValue {
  if (val == null) {
    return true;
  }

  if (Array.isArray(val)) {
    return isHomogeneousAttributeValueArray(val);
  }

  return isValidPrimitiveAttributeValue(val);
}

export function truncateValueIfTooLong(
  value: AttributeValue,
  limit: number | null,
  truncationWarningCallback = () => {}
): AttributeValue {
  if (limit === null) {
    return value;
  }

  if (limit < 32) {
    throw new Error('Value size limit cannot be lower than 32.');
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    // these types can't exceed the attribute value size limit
    return value;
  }

  if (Array.isArray(value)) {
    // note: this is potentially incompatible with a given exporter
    const serialized = JSON.stringify(value);

    if (serialized.length > limit) {
      return truncateValueIfTooLong(
        serialized,
        limit,
        truncationWarningCallback
      );
    }

    return value;
  }

  if (value.length > limit) {
    truncationWarningCallback();
    return value.substring(0, limit);
  }

  return value;
}

function isHomogeneousAttributeValueArray(arr: unknown[]): boolean {
  let type: string | undefined;

  for (const element of arr) {
    // null/undefined elements are allowed
    if (element == null) continue;

    if (!type) {
      if (isValidPrimitiveAttributeValue(element)) {
        type = typeof element;
        continue;
      }
      // encountered an invalid primitive
      return false;
    }

    if (typeof element === type) {
      continue;
    }

    return false;
  }

  return true;
}

function isValidPrimitiveAttributeValue(val: unknown): boolean {
  switch (typeof val) {
    case 'number':
      return true;
    case 'boolean':
      return true;
    case 'string':
      return true;
  }

  return false;
}
