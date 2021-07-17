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

import { Context, ContextManager, ROOT_CONTEXT } from '@opentelemetry/api';
import { Func, TargetWithEvents } from './types';
import { isListenerObject } from './util';

/* Key name to be used to save a context reference in Zone */
const ZONE_CONTEXT_KEY = 'OT_ZONE_CONTEXT';

/**
 * ZoneContextManager
 * This module provides an easy functionality for tracing action between asynchronous operations in web.
 * It was not possible with standard [StackContextManager]{@link https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-web-tracing/src/StackContextManager.ts}.
 * It heavily depends on [zone.js]{@link https://www.npmjs.com/package/zone.js}.
 * It stores the information about context in zone. Each Context will have always new Zone;
 * It also supports binding a certain Span to a target that has "addEventListener" and "removeEventListener".
 * When this happens a new zone is being created and the provided Span is being assigned to this zone.
 */
export class ZoneContextManager implements ContextManager {
  /**
   * whether the context manager is enabled or not
   */
  private _enabled = false;

  /**
   * Helps to create a unique name for the zones - part of zone name
   */
  private _zoneCounter = 0;

  /**
   * Returns the active context from certain zone name
   * @param activeZone
   */
  private _activeContextFromZone(activeZone: Zone | undefined): Context {
    return (activeZone && activeZone.get(ZONE_CONTEXT_KEY)) || ROOT_CONTEXT;
  }

  /**
   * @param context A context (span) to be executed within target function
   * @param target Function to be executed within the context
   */
  private _bindFunction<T extends Function>(context: Context, target: T): T {
    const manager = this;
    const contextWrapper = function (this: any, ...args: unknown[]) {
      return manager.with(context, () => target.apply(this, args));
    };
    Object.defineProperty(contextWrapper, 'length', {
      enumerable: false,
      configurable: true,
      writable: false,
      value: target.length,
    });
    return (contextWrapper as unknown) as T;
  }

  /**
   * @param context A context (span) to be bind to target
   * @param obj target object on which the listeners will be patched
   */
  private _bindListener<T>(context: Context, obj: T): T {
    const target = (obj as unknown) as TargetWithEvents;
    if (target.__ot_listeners !== undefined) {
      return obj;
    }
    target.__ot_listeners = {};

    if (typeof target.addEventListener === 'function') {
      target.addEventListener = this._patchAddEventListener(
        target,
        target.addEventListener,
        context
      );
    }

    if (typeof target.removeEventListener === 'function') {
      target.removeEventListener = this._patchRemoveEventListener(
        target,
        target.removeEventListener
      );
    }

    return obj;
  }

  /**
   * Creates a new unique zone name
   */
  private _createZoneName() {
    this._zoneCounter++;
    const random = Math.random();
    return `${this._zoneCounter}-${random}`;
  }

  /**
   * Creates a new zone
   * @param zoneName zone name
   * @param context A context (span) to be bind with Zone
   */
  private _createZone(zoneName: string, context: unknown): Zone {
    return Zone.current.fork({
      name: zoneName,
      properties: {
        [ZONE_CONTEXT_KEY]: context,
      },
    });
  }

  /**
   * Returns the active zone
   */
  private _getActiveZone(): Zone | undefined {
    return Zone.current;
  }

  /**
   * Patches addEventListener method
   * @param target any target that has "addEventListener" method
   * @param original reference to the patched method
   * @param [context] context to be bind to the listener
   */
  private _patchAddEventListener(
    target: TargetWithEvents,
    original: Function,
    context: Context
  ) {
    const contextManager = this;

    return function (
      this: {},
      event: string,
      listener: Func<void>,
      opts?: any
    ) {
      if (target.__ot_listeners === undefined) {
        target.__ot_listeners = {};
      }
      let listeners = target.__ot_listeners[event];
      if (listeners === undefined) {
        listeners = new WeakMap();
        target.__ot_listeners[event] = listeners;
      }
      const patchedListener = contextManager.bind(context, listener);
      // store a weak reference of the user listener to ours
      listeners.set(listener, patchedListener);
      return original.call(this, event, patchedListener, opts);
    };
  }

  /**
   * Patches removeEventListener method
   * @param target any target that has "removeEventListener" method
   * @param original reference to the patched method
   */
  private _patchRemoveEventListener(
    target: TargetWithEvents,
    original: Function
  ) {
    return function (this: {}, event: string, listener: Func<void>) {
      if (
        target.__ot_listeners === undefined ||
        target.__ot_listeners[event] === undefined
      ) {
        return original.call(this, event, listener);
      }
      const events = target.__ot_listeners[event];
      const patchedListener = events.get(listener);
      events.delete(listener);
      return original.call(this, event, patchedListener || listener);
    };
  }

  /**
   * Returns the active context
   */
  active(): Context {
    if (!this._enabled) {
      return ROOT_CONTEXT;
    }
    const activeZone = this._getActiveZone();

    const active = this._activeContextFromZone(activeZone);
    if (active) {
      return active;
    }

    return ROOT_CONTEXT;
  }

  /**
   * Binds a the certain context or the active one to the target function and then returns the target
   * @param context A context (span) to be bind to target
   * @param target a function or event emitter. When target or one of its callbacks is called,
   *  the provided context will be used as the active context for the duration of the call.
   */
  bind<T>(context: Context, target: T | TargetWithEvents): T {
    // if no specific context to propagate is given, we use the current one
    if (context === undefined) {
      context = this.active();
    }
    if (typeof target === 'function') {
      return this._bindFunction(context, target);
    } else if (isListenerObject(target)) {
      this._bindListener(context, target);
    }
    return (target as unknown) as T;
  }

  /**
   * Disable the context manager (clears all the contexts)
   */
  disable(): this {
    this._enabled = false;
    return this;
  }

  /**
   * Enables the context manager and creates a default(root) context
   */
  enable(): this {
    this._enabled = true;
    return this;
  }

  /**
   * Calls the callback function [fn] with the provided [context].
   *     If [context] is undefined then it will use the active context.
   *     The context will be set as active
   * @param context A context (span) to be called with provided callback
   * @param fn Callback function
   * @param thisArg optional receiver to be used for calling fn
   * @param args optional arguments forwarded to fn
   */
  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    context: Context | null,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    const zoneName = this._createZoneName();

    const newZone = this._createZone(zoneName, context);

    return newZone.run(fn, thisArg, args);
  }
}
