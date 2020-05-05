/*!
 * Copyright 2019, OpenTelemetry Authors
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

import * as types from '@opentelemetry/api';
import {
  addHrTime,
  hrTime,
  hrTimeDuration,
  isTimeInput,
  timeInputToHrTime,
} from '@opentelemetry/core';
import { Resource } from '@opentelemetry/resources';
import { ReadableSpan } from './export/ReadableSpan';
import { Tracer } from './Tracer';
import { SpanProcessor } from './SpanProcessor';
import { TraceParams } from './types';

/**
 * This class represents a span.
 */
export class Span implements types.Span, ReadableSpan {
  // Below properties are included to implement ReadableSpan for export
  // purposes but are not intended to be written-to directly.
  readonly spanContext: types.SpanContext;
  readonly kind: types.SpanKind;
  readonly parentSpanId?: string;
  readonly attributes: types.Attributes = {};
  readonly links: types.Link[] = [];
  readonly events: types.TimedEvent[] = [];
  readonly resource: Resource;
  name: string;
  status: types.Status = {
    code: types.CanonicalCode.OK,
  };
  private _ended = false;
  private _duration: types.HrTime = [0, 0];
  private readonly _logger: types.Logger;
  private readonly _spanProcessor: SpanProcessor;
  private readonly _traceParams: TraceParams;

  /** Performance clock is only used to calculate durations, not real timestamps */
  private readonly _perfStartTime: types.HrTime;
  /** System clock is used to generate start time when a start time is not input by the user */
  private readonly _dateStartTime: types.HrTime;
  /** A user input start time takes precedence over the system clock */
  private readonly _inputStartTime?: types.HrTime;

  /** Constructs a new Span instance. */
  constructor(
    parentTracer: Tracer,
    spanName: string,
    spanContext: types.SpanContext,
    kind: types.SpanKind,
    parentSpanId?: string,
    links: types.Link[] = [],
    startTime?: types.TimeInput
  ) {
    this.name = spanName;
    this.spanContext = spanContext;
    this.parentSpanId = parentSpanId;
    this.kind = kind;
    this.links = links;

    if (startTime != null) {
      this._inputStartTime = timeInputToHrTime(startTime);
    }
    this._perfStartTime = hrTime();
    this._dateStartTime = timeInputToHrTime(Date.now());

    this.resource = parentTracer.resource;
    this._logger = parentTracer.logger;
    this._traceParams = parentTracer.getActiveTraceParams();
    this._spanProcessor = parentTracer.getActiveSpanProcessor();
    this._spanProcessor.onStart(this);
  }

  context(): types.SpanContext {
    return this.spanContext;
  }

  setAttribute(key: string, value: unknown): this {
    if (this._isSpanEnded()) return this;

    if (
      Object.keys(this.attributes).length >=
      this._traceParams.numberOfAttributesPerSpan!
    ) {
      const attributeKeyToDelete = Object.keys(this.attributes).shift();
      if (attributeKeyToDelete) {
        this._logger.warn(
          `Dropping extra attributes : ${attributeKeyToDelete}`
        );
        delete this.attributes[attributeKeyToDelete];
      }
    }
    this.attributes[key] = value;
    return this;
  }

  setAttributes(attributes: types.Attributes): this {
    Object.keys(attributes).forEach(key => {
      this.setAttribute(key, attributes[key]);
    });
    return this;
  }

  /**
   *
   * @param name Span Name
   * @param [attributesOrStartTime] Span attributes or start time
   *     if type is {@type TimeInput} and 3rd param is undefined
   * @param [startTime] Specified start time for the event
   */
  addEvent(
    name: string,
    attributesOrStartTime?: types.Attributes | types.TimeInput,
    startTime?: types.TimeInput
  ): this {
    if (this._isSpanEnded()) return this;
    if (this.events.length >= this._traceParams.numberOfEventsPerSpan!) {
      this._logger.warn('Dropping extra events.');
      this.events.shift();
    }
    if (isTimeInput(attributesOrStartTime)) {
      if (typeof startTime === 'undefined') {
        startTime = attributesOrStartTime as types.TimeInput;
      }
      attributesOrStartTime = undefined;
    }
    if (typeof startTime === 'undefined') {
      startTime = hrTime();
    }
    this.events.push({
      name,
      attributes: attributesOrStartTime as types.Attributes,
      time: timeInputToHrTime(startTime),
    });
    return this;
  }

  setStatus(status: types.Status): this {
    if (this._isSpanEnded()) return this;
    this.status = status;
    return this;
  }

  updateName(name: string): this {
    if (this._isSpanEnded()) return this;
    this.name = name;
    return this;
  }

  end(endTime?: types.TimeInput): void {
    if (this._isSpanEnded()) {
      this._logger.error('You can only call end() on a span once.');
      return;
    }
    this._ended = true;

    if (this._inputStartTime) {
      if (endTime) {
        // user specified start and end time
        this._duration = hrTimeDuration(
          this._inputStartTime,
          timeInputToHrTime(endTime)
        );
      } else {
        // if user specifies start time but not end time, we lose the benefits of the
        // monotonic clock, so we should use the system clock
        this._duration = hrTimeDuration(
          this._inputStartTime,
          timeInputToHrTime(Date.now())
        );
      }
    } else {
      if (endTime) {
        // if user specifies end time but not start time, we lose the benefits of the
        // monotonic clock, so we should used the system clock
        this._duration = hrTimeDuration(
          this._dateStartTime,
          timeInputToHrTime(endTime)
        );
      } else {
        // if no user timestamps are provided, the start time comes from Date, and the end
        // time is calculated using duration from the performance timer
        this._duration = hrTimeDuration(this._perfStartTime, hrTime());
      }
    }

    if (this._duration[0] < 0) {
      this._logger.warn(
        'Inconsistent start and end time, startTime > endTime',
        this.startTime,
        this.endTime
      );
    }

    this._spanProcessor.onEnd(this);
  }

  isRecording(): boolean {
    return true;
  }

  toReadableSpan(): ReadableSpan {
    return this;
  }

  get startTime(): types.HrTime {
    // if user did not specify the start time, use the system clock
    return this._inputStartTime ?? this._dateStartTime;
  }

  get endTime(): types.HrTime {
    // end time is a calculated field based on the start time and duration of the span
    return addHrTime(this.startTime, this.duration);
  }

  get duration(): types.HrTime {
    return this._duration;
  }

  get ended(): boolean {
    return this._ended;
  }

  private _isSpanEnded(): boolean {
    if (this._ended) {
      this._logger.warn(
        'Can not execute the operation on ended Span {traceId: %s, spanId: %s}',
        this.spanContext.traceId,
        this.spanContext.spanId
      );
    }
    return this._ended;
  }
}
