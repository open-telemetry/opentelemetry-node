/**
 * Copyright 2019, OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ScopeManager } from '@opentelemetry/scope-base';
import * as asyncHooks from 'async_hooks';
import { EventEmitter } from 'events';
import * as shimmer from 'shimmer';

const EVENT_EMITTER_METHODS: Array<keyof EventEmitter> = [
  'addListener',
  'on',
  'once',
  'prependListener',
  'prependOnceListener',
];

export class AsyncHooksScopeManager implements ScopeManager {
  private asyncHook: asyncHooks.AsyncHook;
  private scopes: { [uid: number]: unknown } = Object.create(null);

  constructor() {
    this.asyncHook = asyncHooks.createHook({
      init: this.init.bind(this),
      destroy: this.destroy.bind(this),
      promiseResolve: this.destroy.bind(this),
    });
  }

  active(): unknown {
    return this.scopes[asyncHooks.executionAsyncId()] || null;
  }

  with<T extends (...args: unknown[]) => ReturnType<T>>(
    scope: unknown,
    fn: T
  ): ReturnType<T> {
    const uid = asyncHooks.executionAsyncId();
    const oldScope = this.scopes[uid] || null;
    this.scopes[uid] = scope;
    try {
      const res = fn();
      this.scopes[uid] = oldScope;
      return res;
    } catch (err) {
      // restore old scope even if the function throw
      this.scopes[uid] = oldScope;
      throw err;
    }
  }

  bind<T>(target: T, scope?: unknown): T {
    // if no specific scope to propagate is given, we use the current one
    if (!scope) {
      scope = this.active();
    }
    if (target instanceof EventEmitter) {
      return this._bindEventEmitter(target, scope);
    } else if (typeof target === 'function') {
      return this._bindFunction(target, scope);
    }
    return target;
  }

  enable(): this {
    this.asyncHook.enable();
    return this;
  }

  disable(): this {
    this.asyncHook.disable();
    this.scopes = {};
    return this;
  }

  private _bindFunction<T extends Function>(target: T, scope?: unknown): T {
    const manager = this;
    const contextWrapper = function(this: {}) {
      return manager.with(scope, () => target.apply(this, arguments));
    };
    Object.defineProperty(contextWrapper, 'length', {
      enumerable: false,
      configurable: true,
      writable: false,
      value: target.length,
    });
    /**
     * It isnt possible to tell Typescript that contextWrapper is the same as T
     * so we forced to cast as any here.
     */
    // tslint:disable-next-line:no-any
    return contextWrapper as any;
  }

  /**
   * By default, EventEmitter call their callback with their scope, which we do
   * not want, instead we will bind a specific scope to all callbacks that
   * go through it.
   * @param target EventEmitter a instance of EventEmitter to patch
   * @param scope the scope we want to bind
   */
  private _bindEventEmitter<T extends EventEmitter>(
    target: T,
    scope?: unknown
  ): T {
    const scopeManager = this;
    EVENT_EMITTER_METHODS.forEach(methodName => {
      if (target[methodName] === undefined) return;
      shimmer.wrap(target as EventEmitter, methodName, (original: Function) => {
        return function(this: {}, event: string, cb: Function) {
          return original.call(this, event, scopeManager.bind(cb, scope));
        };
      });
    });
    return target;
  }

  /**
   * Init hook will be called when userland create a async scope, setting the
   * scope as the current one if it exist.
   * @param uid id of the async scope
   */
  private init(uid: number) {
    this.scopes[uid] = this.scopes[asyncHooks.executionAsyncId()];
  }

  /**
   * Destroy hook will be called when a given scope is no longer used so we can
   * remove its attached scope.
   * @param uid uid of the async scope
   */
  private destroy(uid: number) {
    delete this.scopes[uid];
  }
}
