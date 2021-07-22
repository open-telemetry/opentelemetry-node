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

import { Context, ROOT_CONTEXT } from '@opentelemetry/api';
import * as asyncHooks from 'async_hooks';
import { AbstractAsyncHooksContextManager } from './AbstractAsyncHooksContextManager';

export class AsyncHooksContextManager extends AbstractAsyncHooksContextManager {
  private _asyncHook: asyncHooks.AsyncHook;
  private _contexts: Map<number, Context> = new Map();
  private _stack: Array<Context | undefined> = [];

  constructor() {
    super();
    this._asyncHook = asyncHooks.createHook({
      init: this._init.bind(this),
      before: this._before.bind(this),
      after: this._after.bind(this),
      destroy: this._destroy.bind(this),
      promiseResolve: this._destroy.bind(this),
    });
  }

  active(): Context {
    return this._stack[this._stack.length - 1] ?? ROOT_CONTEXT;
  }

  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    context: Context,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    this._enterContext(context);
    try {
      return fn.call(thisArg, ...args);
    } finally {
      this._exitContext();
    }
  }

  enable(): this {
    this._asyncHook.enable();
    return this;
  }

  disable(): this {
    this._asyncHook.disable();
    this._contexts.clear();
    this._stack = [];
    return this;
  }

  /**
   * Init hook will be called when userland create a async context, setting the
   * context as the current one if it exist.
   * @param uid id of the async context
   * @param type the resource type
   */
  private _init(uid: number, type: string) {
    // ignore TIMERWRAP as they combine timers with same timeout which can lead to
    // false context propagation. TIMERWRAP has been removed in node 11
    // every timer has it's own `Timeout` resource anyway which is used to propagete
    // context.
    if (type === 'TIMERWRAP') return;

    const context = this._stack[this._stack.length - 1];
    if (context !== undefined) {
      this._contexts.set(uid, context);
    }
  }

  /**
   * Destroy hook will be called when a given context is no longer used so we can
   * remove its attached context.
   * @param uid uid of the async context
   */
  private _destroy(uid: number) {
    this._contexts.delete(uid);
  }

  /**
   * Before hook is called just before executing a async context.
   * @param uid uid of the async context
   */
  private _before(uid: number) {
    const context = this._contexts.get(uid);
    if (context !== undefined) {
      this._enterContext(context);
    }
  }

  /**
   * After hook is called just after completing the execution of a async context.
   */
  private _after() {
    this._exitContext();
  }

  /**
   * Set the given context as active
   */
  private _enterContext(context: Context) {
    this._stack.push(context);
  }

  /**
   * Remove the context at the root of the stack
   */
  private _exitContext() {
    this._stack.pop();
  }
}
