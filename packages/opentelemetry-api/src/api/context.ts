/*!
 * Copyright 2020, OpenTelemetry Authors
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
  ContextManager,
  NoopContextManager,
  Context,
} from '@opentelemetry/context-base';

const NOOP_CONTEXT_MANAGER = new NoopContextManager();

const GLOBAL_CONTEXT_MANAGER_API_KEY = Symbol.for(
  'io.opentelemetry.js.api.context'
);
const API_VERSION = 0;

/**
 * Singleton object which represents the entry point to the OpenTelemetry Context API
 */
export class ContextAPI {
  private static _instance?: ContextAPI;

  /** Empty private constructor prevents end users from constructing a new instance of the API */
  private constructor() {}

  /** Get the singleton instance of the Context API */
  public static getInstance(): ContextAPI {
    if (!this._instance) {
      this._instance = new ContextAPI();
    }

    return this._instance;
  }

  /**
   * Set the current context manager. Returns the initialized context manager
   */
  public setGlobalContextManager(
    contextManager: ContextManager
  ): ContextManager {
    if ((global as any)[GLOBAL_CONTEXT_MANAGER_API_KEY]) {
      // global context manager has already been set
      return NOOP_CONTEXT_MANAGER;
    }

    (global as any)[GLOBAL_CONTEXT_MANAGER_API_KEY] = function getTraceApi(
      version: number
    ) {
      if (version !== API_VERSION) {
        return NOOP_CONTEXT_MANAGER;
      }

      return contextManager;
    };

    return contextManager;
  }

  /**
   * Get the currently active context
   */
  public active(): Context {
    return this._getContextManager().active();
  }

  /**
   * Execute a function with an active context
   *
   * @param context context to be active during function execution
   * @param fn function to execute in a context
   */
  public with<T extends (...args: unknown[]) => ReturnType<T>>(
    context: Context,
    fn: T
  ): ReturnType<T> {
    return this._getContextManager().with(context, fn);
  }

  /**
   * Bind a context to a target function or event emitter
   *
   * @param target function or event emitter to bind
   * @param context context to bind to the event emitter or function. Defaults to the currently active context
   */
  public bind<T>(target: T, context: Context = this.active()): T {
    return this._getContextManager().bind(target, context);
  }

  private _getContextManager(): ContextManager {
    if (!(global as any)[GLOBAL_CONTEXT_MANAGER_API_KEY]) {
      return NOOP_CONTEXT_MANAGER;
    }

    return (global as any)[GLOBAL_CONTEXT_MANAGER_API_KEY](API_VERSION);
  }

  /** Disable and remove the global context manager */
  public disable() {
    this._getContextManager().disable();
    delete (global as any)[GLOBAL_CONTEXT_MANAGER_API_KEY];
  }
}
