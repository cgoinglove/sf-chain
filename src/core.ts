import { isFunction, isPromiseLike } from "./shared";

/**
 * Represents any value that can be treated as an error.
 */
export type ErrorLike = Error | string | unknown;

type P = PromiseLike<any>;
/**
 * Represents a safe chain of operations that handles errors gracefully
 * and supports both synchronous and asynchronous operations.
 */
export interface SafeChain<T> {
  /**
   * Transforms the value inside the chain with the given function.
   * If the chain contains an error, the transform is not applied.
   *
   * @param transform Function to transform the value
   * @returns A new SafeChain containing the transformed value
   */
  map<U>(
    transform: (value: Awaited<T>) => U,
  ): T extends P ? SafeChain<PromiseLike<Awaited<U>>> : SafeChain<U>;

  /**
   * Transforms the value inside the chain with a function that returns another SafeChain.
   * This allows flattening nested SafeChains.
   *
   * @param transform Function that returns another SafeChain
   * @returns A flattened SafeChain
   */
  flatMap<U>(
    transform: (value: Awaited<T>) => SafeChain<U>,
  ): T extends P ? SafeChain<PromiseLike<Awaited<U>>> : SafeChain<U>;

  /**
   * Observes the value without affecting the chain.
   * Any errors thrown inside this function are ignored and will not affect the chain.
   *
   * @param consumer Function to observe the value
   * @returns The same SafeChain for chaining
   */
  tap(consumer: (value: Awaited<T>) => any): SafeChain<T>;

  /**
   * Applies an effect to the value which may affect the chain.
   * Errors thrown inside this function will be propagated to the chain.
   *
   * @param effectFn Function to apply an effect to the value
   * @returns The same SafeChain for chaining
   */
  effect<U>(
    effectFn: (value: Awaited<T>) => U,
  ): U extends P ? SafeChain<PromiseLike<Awaited<T>>> : SafeChain<T>;

  /**
   * Observes an error without affecting the chain.
   * Any errors thrown inside this function are ignored and will not affect the chain.
   *
   * @param consumer Function to observe the error
   * @returns The same SafeChain for chaining
   */
  tapError(consumer: (error: Error) => any): SafeChain<T>;

  /**
   * Handles an error by providing a replacement value.
   * If the chain contains a success value, that value is kept.
   *
   * @param handler Function that returns a replacement value if there's an error
   * @returns A SafeChain with either the original value or the recovery value
   */
  recover<U>(
    handler: (error: Error) => U,
  ): T extends P ? SafeChain<PromiseLike<Awaited<U>>> : SafeChain<U>;

  /**
   * Checks if the chain contains a success value.
   *
   * @returns Boolean indicating success (or PromiseLike<boolean> for async chains)
   */
  isOk(): T extends P ? Promise<boolean> : boolean;

  /**
   * Checks if the chain contains an error.
   *
   * @returns Boolean indicating error (or PromiseLike<boolean> for async chains)
   */
  isError(): T extends P ? Promise<boolean> : boolean;

  /**
   * Extracts the value from the chain.
   * Throws if the chain contains an error.
   *
   * @returns The value (or PromiseLike<value> for async chains)
   * @throws The error if present
   */
  unwrap(): T extends P ? PromiseLike<Awaited<T>> : T;

  /**
   * Converts the chain to a PromiseLike.
   * The PromiseLike resolves with the value or rejects with the error.
   *
   * @returns PromiseLike that resolves with the value or rejects with the error
   */
  toPromise(): Promise<Awaited<T>>;

  /**
   * @deprecated Use effect() instead
   */
  ifOk<U>(
    consumer: (value: Awaited<T>) => U,
  ): T extends P ? SafeChain<PromiseLike<Awaited<U>>> : SafeChain<U>;

  /**
   * @deprecated Use tapError() instead
   */
  ifError(consumer: (error: Error) => any): SafeChain<T>;
}

type Result<T = any> =
  | {
      isError: true;
      error: Error;
      value?: undefined;
    }
  | {
      isError: false;
      error?: undefined;
      value: T;
    };

class ResultChain<T = undefined> implements SafeChain<T> {
  private result: Result<Awaited<T>>;
  private promise?: PromiseLike<void>;

  constructor() {
    this.result = {
      isError: false,
      value: undefined as Awaited<T>,
    };
  }

  private ok(value: Awaited<T>) {
    this.result = {
      isError: false,
      value,
    };
  }

  private error(err: ErrorLike) {
    this.result = {
      isError: true,
      error: this.normalizeError(err),
    };
  }

  private normalizeError(error: ErrorLike): Error {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }

  private next<U>(
    cb: (r: Result<Awaited<T>>) => U,
  ): T extends P ? SafeChain<PromiseLike<Awaited<U>>> : SafeChain<U> {
    const instance = new ResultChain<unknown>();

    if (this.promise) {
      // Handle async case
      instance.promise = this.promise
        .then(() => cb(this.result))
        .then(instance.ok.bind(instance), instance.error.bind(instance));
    } else {
      // Handle sync case
      try {
        const next = cb(this.result);
        if (isPromiseLike(next)) {
          instance.promise = next.then(
            instance.ok.bind(instance),
            instance.error.bind(instance),
          );
        } else {
          instance.ok(next);
        }
      } catch (err) {
        instance.error(err);
      }
    }

    return instance as unknown as T extends P
      ? SafeChain<PromiseLike<Awaited<U>>>
      : SafeChain<U>;
  }

  map<U>(
    transform: (value: Awaited<T>) => U,
  ): T extends P ? SafeChain<PromiseLike<Awaited<U>>> : SafeChain<U> {
    return this.next((result) => {
      if (result.isError) throw result.error;
      return transform(result.value);
    });
  }

  flatMap<U>(
    transform: (value: Awaited<T>) => SafeChain<U>,
  ): T extends P ? SafeChain<PromiseLike<Awaited<U>>> : SafeChain<U> {
    return this.next((result) => {
      if (result.isError) throw result.error;

      const chain = transform(result.value);
      return chain.unwrap();
    }) as unknown as T extends P
      ? SafeChain<PromiseLike<Awaited<U>>>
      : SafeChain<U>;
  }

  tap(consumer: (value: Awaited<T>) => any): SafeChain<T> {
    return this.next((result) => {
      if (result.isError) throw result.error;
      try {
        consumer(result.value);
      } catch {
        // Ignore any errors from the consumer
      }
      return result.value;
    }) as SafeChain<T>;
  }

  effect<U>(
    effectFn: (value: Awaited<T>) => U,
  ): U extends P ? SafeChain<PromiseLike<Awaited<T>>> : SafeChain<T> {
    return this.next((result) => {
      if (result.isError) throw result.error;
      // Errors from effectFn will be caught by next() and affect the chain
      const v = effectFn(result.value);
      if (isPromiseLike(v)) {
        // Wait for the promise to resolve, reject will be handled by next()
        return v.then(() => result.value);
      }
      return result.value;
    }) as U extends P ? SafeChain<PromiseLike<Awaited<T>>> : SafeChain<T>;
  }

  tapError(consumer: (error: Error) => any): SafeChain<T> {
    return this.next((result) => {
      if (result.isError) {
        try {
          consumer(result.error);
        } catch {
          // Ignore any errors from the consumer
        }
        throw result.error;
      }
      return result.value;
    }) as SafeChain<T>;
  }

  // Legacy method, delegates to effect
  ifOk<U>(
    consumer: (value: Awaited<T>) => U,
  ): T extends P ? SafeChain<PromiseLike<Awaited<U>>> : SafeChain<U> {
    return this.effect(consumer) as unknown as T extends P
      ? SafeChain<PromiseLike<Awaited<U>>>
      : SafeChain<U>;
  }

  // Legacy method, delegates to tapError
  ifError(consumer: (error: Error) => any): SafeChain<T> {
    return this.tapError(consumer) as SafeChain<T>;
  }

  recover<U>(
    handler: (error: Error) => U,
  ): T extends P ? SafeChain<PromiseLike<Awaited<U>>> : SafeChain<U> {
    return this.next((result) => {
      if (result.isError) {
        return handler(result.error);
      }
      return result.value;
    }) as unknown as T extends P
      ? SafeChain<PromiseLike<Awaited<U>>>
      : SafeChain<U>;
  }

  isOk(): T extends P ? Promise<boolean> : boolean {
    if (this.promise) {
      return (async () => {
        await this.promise;
        return !this.result.isError;
      })() as T extends P ? Promise<boolean> : boolean;
    }

    return !this.result.isError as T extends P ? Promise<boolean> : boolean;
  }

  isError(): T extends P ? Promise<boolean> : boolean {
    if (this.promise) {
      return (async () => {
        await this.promise;
        return this.result.isError;
      })() as T extends P ? Promise<boolean> : boolean;
    }

    return this.result.isError as T extends P ? Promise<boolean> : boolean;
  }

  unwrap(): T extends P ? PromiseLike<Awaited<T>> : T {
    if (this.promise) {
      return (async () => {
        await this.promise;
        if (this.result.isError) throw this.result.error;
        return this.result.value as T extends P ? PromiseLike<Awaited<T>> : T;
      })() as T extends P ? PromiseLike<Awaited<T>> : T;
    }

    if (this.result.isError) throw this.result.error;
    return this.result.value as T extends P ? PromiseLike<Awaited<T>> : T;
  }

  toPromise(): Promise<Awaited<T>> {
    if (this.promise) {
      return this.promise.then(() => {
        if (this.result.isError) return Promise.reject(this.result.error);
        return Promise.resolve(this.result.value);
      }) as Promise<Awaited<T>>;
    }

    return this.result.isError
      ? Promise.reject(this.result.error)
      : Promise.resolve(this.result.value);
  }
}

/**
 * Creates a SafeChain from an existing value.
 *
 * @param value The value to wrap in a SafeChain
 * @returns A SafeChain containing the value
 */
export function safeValue<T>(value: T): SafeChain<T> {
  const chain = new ResultChain<T>();
  try {
    return chain.map(() => value) as SafeChain<T>;
  } catch (e) {
    return chain.map(() => {
      throw e;
    }) as SafeChain<T>;
  }
}

/**
 * Creates a SafeChain by executing a function.
 * If the function throws, the error is captured in the chain.
 *
 * @param fn The function to execute
 * @returns A SafeChain containing the function's return value or error
 */
export function safeExec<T>(fn: () => T): SafeChain<T> {
  const chain = new ResultChain<T>();
  try {
    return chain.map(() => fn()) as SafeChain<T>;
  } catch (e) {
    return chain.map(() => {
      throw e;
    }) as SafeChain<T>;
  }
}

/**
 * Creates an empty SafeChain with undefined value.
 *
 * @returns A SafeChain containing undefined
 */
export function safeEmpty(): SafeChain<undefined> {
  return safeValue(undefined);
}

/**
 *
 * @param init Optional value or function that returns a value
 * @returns A SafeChain containing the value or function result
 */
export function safe<T>(init: () => T): SafeChain<T>;
export function safe<T>(init: T): SafeChain<T>;
export function safe(): SafeChain<undefined>;
export function safe<T>(init?: T | (() => T)): SafeChain<T> {
  if (init === undefined) return safeEmpty() as SafeChain<T>;
  if (isFunction(init)) return safeExec(init);
  return safeValue(init);
}
