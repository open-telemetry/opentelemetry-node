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
  ScopeManager,
  NoopScopeManager,
  Context,
} from '@opentelemetry/scope-base';

/**
 * Singleton object which represents the entry point to the OpenTelemetry Context API
 */
export class ContextAPI {
  private static _instance?: ContextAPI;
  private _manager: ScopeManager = new NoopScopeManager();

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
  public initGlobalContextManager(contextManager: ScopeManager): ScopeManager {
    this._manager = contextManager;
    return contextManager;
  }

  /**
   * Get the currently active context
   */
  public active(): Context {
    return this._manager.active();
  }

  /**
   * Execute a function with an active context
   *
   * @param fn function to execute in a context
   * @param scope context to be active during function execution. Defaults to the currently active context
   */
  public with<T extends (...args: unknown[]) => ReturnType<T>>(
    fn: T,
    scope: Context = this.active()
  ): ReturnType<T> {
    return this._manager.with(scope, fn);
  }

  /**
   *
   * @param target function or event emitter to bind
   * @param scope context to bind to the event emitter or function. Defaults to the currently active context
   */
  public bind<T>(target: T, scope: Context = this.active()): T {
    return this._manager.bind(target, scope);
  }
}
