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

import * as api from '@opentelemetry/api';
import {
  isWrapped,
  InstrumentationBase,
  InstrumentationConfig,
  safeExecuteInTheMiddle,
} from '@opentelemetry/instrumentation';
import { hrTime, isUrlIgnored, otperformance } from '@opentelemetry/core';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import {
  addSpanNetworkEvents,
  getResource,
  parseUrl,
  PerformanceTimingNames as PTN,
  shouldPropagateTraceHeaders,
} from '@opentelemetry/web';
import { EventNames } from './enums/EventNames';
import {
  OpenFunction,
  PropagateTraceHeaderCorsUrls,
  SendFunction,
  XhrMem,
} from './types';
import { VERSION } from './version';
import { AttributeNames } from './enums/AttributeNames';

// how long to wait for observer to collect information about resources
// this is needed as event "load" is called before observer
// hard to say how long it should really wait, seems like 300ms is
// safe enough
const OBSERVER_WAIT_TIME_MS = 300;

export type XHRCustomAttributeFunction = (
  span: api.Span,
  xhr: XMLHttpRequest
) => void;

/**
 * XMLHttpRequest config
 */
export interface XMLHttpRequestInstrumentationConfig
  extends InstrumentationConfig {
  // the number of timing resources is limited, after the limit
  // (chrome 250, safari 150) the information is not collected anymore
  // the only way to prevent that is to regularly clean the resources
  // whenever it is possible, this is needed only when PerformanceObserver
  // is not available
  clearTimingResources?: boolean;
  // urls which should include trace headers when origin doesn't match
  propagateTraceHeaderCorsUrls?: PropagateTraceHeaderCorsUrls;
  /**
   * URLs that partially match any regex in ignoreUrls will not be traced.
   * In addition, URLs that are _exact matches_ of strings in ignoreUrls will
   * also not be traced.
   */
  ignoreUrls?: Array<string | RegExp>;
  /** Function for adding custom attributes on the span */
  applyCustomAttributesOnSpan?: XHRCustomAttributeFunction;
}

/**
 * This class represents a XMLHttpRequest plugin for auto instrumentation
 */
export class XMLHttpRequestInstrumentation extends InstrumentationBase<XMLHttpRequest> {
  readonly component: string = 'xml-http-request';
  readonly version: string = VERSION;
  moduleName = this.component;

  private _tasksCount = 0;
  private _xhrMem = new WeakMap<XMLHttpRequest, XhrMem>();
  private _usedResources = new WeakSet<PerformanceResourceTiming>();

  constructor(
    config: XMLHttpRequestInstrumentationConfig & InstrumentationConfig = {}
  ) {
    super(
      '@opentelemetry/instrumentation-xml-http-request',
      VERSION,
      Object.assign({}, config)
    );
  }

  init() {}

  private _getConfig(): XMLHttpRequestInstrumentationConfig {
    return this._config;
  }

  /**
   * Adds custom headers to XMLHttpRequest
   * @param xhr
   * @param span
   * @private
   */
  private _addHeaders(xhr: XMLHttpRequest, spanUrl: string) {
    if (
      !shouldPropagateTraceHeaders(
        spanUrl,
        this._getConfig().propagateTraceHeaderCorsUrls
      )
    ) {
      const headers: Partial<Record<string, unknown>> = {};
      api.propagation.inject(api.context.active(), headers);
      if (Object.keys(headers).length > 0) {
        api.diag.debug('headers inject skipped due to CORS policy');
      }
      return;
    }
    const headers: { [key: string]: unknown } = {};
    api.propagation.inject(api.context.active(), headers);
    Object.keys(headers).forEach(key => {
      xhr.setRequestHeader(key, String(headers[key]));
    });
  }

  /**
   * Add cors pre flight child span
   * @param span
   * @param corsPreFlightRequest
   * @private
   */
  private _addChildSpan(
    span: api.Span,
    corsPreFlightRequest: PerformanceResourceTiming
  ): void {
    api.context.with(api.trace.setSpan(api.context.active(), span), () => {
      const childSpan = this.tracer.startSpan('CORS Preflight', {
        startTime: corsPreFlightRequest[PTN.FETCH_START],
      });
      addSpanNetworkEvents(childSpan, corsPreFlightRequest);
      childSpan.end(corsPreFlightRequest[PTN.RESPONSE_END]);
    });
  }

  /**
   * Add attributes when span is going to end
   * @param span
   * @param xhr
   * @param spanUrl
   * @private
   */
  _addFinalSpanAttributes(span: api.Span, xhrMem: XhrMem, spanUrl?: string) {
    if (typeof spanUrl === 'string') {
      const parsedUrl = parseUrl(spanUrl);
      if (xhrMem.status !== undefined) {
        span.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, xhrMem.status);
      }
      if (xhrMem.statusText !== undefined) {
        span.setAttribute(AttributeNames.HTTP_STATUS_TEXT, xhrMem.statusText);
      }
      span.setAttribute(SemanticAttributes.HTTP_HOST, parsedUrl.host);
      span.setAttribute(
        SemanticAttributes.HTTP_SCHEME,
        parsedUrl.protocol.replace(':', '')
      );

      // @TODO do we want to collect this or it will be collected earlier once only or
      //    maybe when parent span is not available ?
      span.setAttribute(
        SemanticAttributes.HTTP_USER_AGENT,
        navigator.userAgent
      );
    }
  }

  private _applyAttributesAfterXHR(span: api.Span, xhr: XMLHttpRequest) {
    const applyCustomAttributesOnSpan = this._getConfig()
      .applyCustomAttributesOnSpan;
    if (typeof applyCustomAttributesOnSpan === 'function') {
      safeExecuteInTheMiddle(
        () => applyCustomAttributesOnSpan(span, xhr),
        error => {
          if (!error) {
            return;
          }

          api.diag.error('applyCustomAttributesOnSpan', error);
        },
        true
      );
    }
  }

  /**
   * will collect information about all resources created
   * between "send" and "end" with additional waiting for main resource
   * @param xhr
   * @param spanUrl
   * @private
   */
  private _addResourceObserver(xhr: XMLHttpRequest, spanUrl: string) {
    const xhrMem = this._xhrMem.get(xhr);
    if (
      !xhrMem ||
      typeof window.PerformanceObserver === 'undefined' ||
      typeof window.PerformanceResourceTiming === 'undefined'
    ) {
      return;
    }
    xhrMem.createdResources = {
      observer: new PerformanceObserver(list => {
        const entries = list.getEntries() as PerformanceResourceTiming[];
        entries.forEach(entry => {
          if (
            entry.initiatorType === 'xmlhttprequest' &&
            entry.name === spanUrl
          ) {
            if (xhrMem.createdResources) {
              xhrMem.createdResources.entries.push(entry);
            }
          }
        });
      }),
      entries: [],
    };
    xhrMem.createdResources.observer.observe({
      entryTypes: ['resource'],
    });
  }

  /**
   * Clears the resource timings and all resources assigned with spans
   *     when {@link XMLHttpRequestInstrumentationConfig.clearTimingResources} is
   *     set to true (default false)
   * @private
   */
  private _clearResources() {
    if (this._tasksCount === 0 && this._getConfig().clearTimingResources) {
      ((otperformance as unknown) as Performance).clearResourceTimings();
      this._xhrMem = new WeakMap<XMLHttpRequest, XhrMem>();
      this._usedResources = new WeakSet<PerformanceResourceTiming>();
    }
  }

  /**
   * Finds appropriate resource and add network events to the span
   * @param span
   */
  private _findResourceAndAddNetworkEvents(
    xhrMem: XhrMem,
    span: api.Span,
    spanUrl?: string,
    startTime?: api.HrTime,
    endTime?: api.HrTime
  ): void {
    if (!spanUrl || !startTime || !endTime || !xhrMem.createdResources) {
      return;
    }

    let resources: PerformanceResourceTiming[] =
      xhrMem.createdResources.entries;

    if (!resources || !resources.length) {
      // fallback - either Observer is not available or it took longer
      // then OBSERVER_WAIT_TIME_MS and observer didn't collect enough
      // information
      // ts thinks this is the perf_hooks module, but it is the browser performance api
      resources = ((otperformance as unknown) as Performance).getEntriesByType(
        'resource'
      ) as PerformanceResourceTiming[];
    }

    const resource = getResource(
      spanUrl,
      startTime,
      endTime,
      resources,
      this._usedResources
    );

    if (resource.mainRequest) {
      const mainRequest = resource.mainRequest;
      this._markResourceAsUsed(mainRequest);

      const corsPreFlightRequest = resource.corsPreFlightRequest;
      if (corsPreFlightRequest) {
        this._addChildSpan(span, corsPreFlightRequest);
        this._markResourceAsUsed(corsPreFlightRequest);
      }
      addSpanNetworkEvents(span, mainRequest);
    }
  }

  /**
   * Removes the previous information about span.
   * This might happened when the same xhr is used again.
   * @param xhr
   * @private
   */
  private _cleanPreviousSpanInformation(xhr: XMLHttpRequest) {
    const xhrMem = this._xhrMem.get(xhr);
    if (xhrMem) {
      const callbackToRemoveEvents = xhrMem.callbackToRemoveEvents;
      if (callbackToRemoveEvents) {
        callbackToRemoveEvents();
      }
      this._xhrMem.delete(xhr);
    }
  }

  /**
   * Creates a new span when method "open" is called
   * @param xhr
   * @param url
   * @param method
   * @private
   */
  private _createSpan(
    xhr: XMLHttpRequest,
    url: string,
    method: string
  ): api.Span | undefined {
    if (isUrlIgnored(url, this._getConfig().ignoreUrls)) {
      api.diag.debug('ignoring span as url matches ignored url');
      return;
    }
    const spanName = `HTTP ${method.toUpperCase()}`;

    const currentSpan = this.tracer.startSpan(spanName, {
      kind: api.SpanKind.CLIENT,
      attributes: {
        [SemanticAttributes.HTTP_METHOD]: method,
        [SemanticAttributes.HTTP_URL]: url,
      },
    });

    currentSpan.addEvent(EventNames.METHOD_OPEN);

    this._cleanPreviousSpanInformation(xhr);

    this._xhrMem.set(xhr, {
      span: currentSpan,
      spanUrl: url,
    });

    return currentSpan;
  }

  /**
   * Marks certain [resource]{@link PerformanceResourceTiming} when information
   * from this is used to add events to span.
   * This is done to avoid reusing the same resource again for next span
   * @param resource
   * @private
   */
  private _markResourceAsUsed(resource: PerformanceResourceTiming) {
    this._usedResources.add(resource);
  }

  /**
   * Patches the method open
   * @private
   */
  protected _patchOpen() {
    return (original: OpenFunction): OpenFunction => {
      const plugin = this;
      return function patchOpen(this: XMLHttpRequest, ...args): void {
        const method: string = args[0];
        const url: string = args[1];
        plugin._createSpan(this, url, method);

        return original.apply(this, args);
      };
    };
  }

  /**
   * Patches the method send
   * @private
   */
  protected _patchSend() {
    const plugin = this;

    function endSpanTimeout(
      eventName: string,
      xhrMem: XhrMem,
      endTime: api.HrTime
    ) {
      const callbackToRemoveEvents = xhrMem.callbackToRemoveEvents;

      if (typeof callbackToRemoveEvents === 'function') {
        callbackToRemoveEvents();
      }

      const { span, spanUrl, sendStartTime } = xhrMem;

      if (span) {
        plugin._findResourceAndAddNetworkEvents(
          xhrMem,
          span,
          spanUrl,
          sendStartTime,
          endTime
        );
        span.addEvent(eventName, endTime);
        plugin._addFinalSpanAttributes(span, xhrMem, spanUrl);
        span.end(endTime);
        plugin._tasksCount--;
      }
      plugin._clearResources();
    }

    function endSpan(eventName: string, xhr: XMLHttpRequest) {
      const xhrMem = plugin._xhrMem.get(xhr);
      if (!xhrMem) {
        return;
      }
      xhrMem.status = xhr.status;
      xhrMem.statusText = xhr.statusText;
      plugin._xhrMem.delete(xhr);

      if (xhrMem.span) {
        plugin._applyAttributesAfterXHR(xhrMem.span, xhr);
      }
      const endTime = hrTime();

      // the timeout is needed as observer doesn't have yet information
      // when event "load" is called. Also the time may differ depends on
      // browser and speed of computer
      setTimeout(() => {
        endSpanTimeout(eventName, xhrMem, endTime);
      }, OBSERVER_WAIT_TIME_MS);
    }

    function onError(this: XMLHttpRequest) {
      endSpan(EventNames.EVENT_ERROR, this);
    }

    function onAbort(this: XMLHttpRequest) {
      endSpan(EventNames.EVENT_ABORT, this);
    }

    function onTimeout(this: XMLHttpRequest) {
      endSpan(EventNames.EVENT_TIMEOUT, this);
    }

    function onLoad(this: XMLHttpRequest) {
      if (this.status < 299) {
        endSpan(EventNames.EVENT_LOAD, this);
      } else {
        endSpan(EventNames.EVENT_ERROR, this);
      }
    }

    function unregister(xhr: XMLHttpRequest) {
      xhr.removeEventListener('abort', onAbort);
      xhr.removeEventListener('error', onError);
      xhr.removeEventListener('load', onLoad);
      xhr.removeEventListener('timeout', onTimeout);
      const xhrMem = plugin._xhrMem.get(xhr);
      if (xhrMem) {
        xhrMem.callbackToRemoveEvents = undefined;
      }
    }

    return (original: SendFunction): SendFunction => {
      return function patchSend(this: XMLHttpRequest, ...args): void {
        const xhrMem = plugin._xhrMem.get(this);
        if (!xhrMem) {
          return original.apply(this, args);
        }
        const currentSpan = xhrMem.span;
        const spanUrl = xhrMem.spanUrl;

        if (currentSpan && spanUrl) {
          api.context.with(
            api.trace.setSpan(api.context.active(), currentSpan),
            () => {
              plugin._tasksCount++;
              xhrMem.sendStartTime = hrTime();
              currentSpan.addEvent(EventNames.METHOD_SEND);

              this.addEventListener('abort', onAbort);
              this.addEventListener('error', onError);
              this.addEventListener('load', onLoad);
              this.addEventListener('timeout', onTimeout);

              xhrMem.callbackToRemoveEvents = () => {
                unregister(this);
                if (xhrMem.createdResources) {
                  xhrMem.createdResources.observer.disconnect();
                }
              };
              plugin._addHeaders(this, spanUrl);
              plugin._addResourceObserver(this, spanUrl);
            }
          );
        }
        return original.apply(this, args);
      };
    };
  }

  /**
   * implements enable function
   */
  override enable() {
    api.diag.debug('applying patch to', this.moduleName, this.version);

    if (isWrapped(XMLHttpRequest.prototype.open)) {
      this._unwrap(XMLHttpRequest.prototype, 'open');
      api.diag.debug('removing previous patch from method open');
    }

    if (isWrapped(XMLHttpRequest.prototype.send)) {
      this._unwrap(XMLHttpRequest.prototype, 'send');
      api.diag.debug('removing previous patch from method send');
    }

    this._wrap(XMLHttpRequest.prototype, 'open', this._patchOpen());
    this._wrap(XMLHttpRequest.prototype, 'send', this._patchSend());
  }

  /**
   * implements disable function
   */
  override disable() {
    api.diag.debug('removing patch from', this.moduleName, this.version);

    this._unwrap(XMLHttpRequest.prototype, 'open');
    this._unwrap(XMLHttpRequest.prototype, 'send');

    this._tasksCount = 0;
    this._xhrMem = new WeakMap<XMLHttpRequest, XhrMem>();
    this._usedResources = new WeakSet<PerformanceResourceTiming>();
  }
}
