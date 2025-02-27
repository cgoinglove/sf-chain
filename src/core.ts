import { Result, SafeResult } from "./result";
import { isPromiseLike } from "./shared";

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
   * This method changes the value type from T to U.
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
   * This method changes the value type from T to U.
   *
   * @param transform Function that returns another SafeChain
   * @returns A flattened SafeChain
   */
  flatMap<U>(
    transform: (value: Awaited<T>) => SafeChain<U>,
  ): T extends P ? SafeChain<PromiseLike<Awaited<U>>> : SafeChain<U>;

  /**
   * Observes the current state of the chain without affecting it.
   * The observer receives the complete result object containing either a value or an error.
   * Any errors thrown inside this function are ignored and will not affect the chain.
   * Any Promise returned is also ignored and will not affect the chain's type.
   * The original state of the chain is preserved regardless of what happens in the consumer function.
   *
   * @param consumer Function to observe the current result state
   * @returns The same SafeChain for chaining, preserving the original type T
   */
  tap(consumer: (result: Result<Awaited<T>>) => any): SafeChain<T>;

  /**
   * Applies an effect to the value which may affect the chain.
   * Errors thrown inside this function will be propagated to the chain.
   * If the effectFn returns a Promise, the chain will become asynchronous.
   * The value type T remains the same, but the chain's synchronicity may change.
   *
   * @param effectFn Function to apply an effect to the value
   * @returns The same SafeChain for chaining, with the same value type T but possibly different promise state
   */
  effect<U>(
    effectFn: (value: Awaited<T>) => U,
  ): U extends P ? SafeChain<PromiseLike<Awaited<T>>> : SafeChain<T>;

  /**
   * Handles an error by providing a fallback value.
   * If the chain contains a success value, that value is kept.
   * If the handler returns a Promise, the chain will become asynchronous.
   * This method can change the value type from T to U when an error occurs.
   *
   * @param handler Function that returns a fallback value if there's an error
   * @returns A SafeChain with either the original value or the recovery value
   */
  recover<U>(
    handler: (error: Error) => U,
  ): T extends P ? SafeChain<PromiseLike<Awaited<U>>> : SafeChain<U>;

  /**
   * Checks if the chain contains a success value.
   * The return type depends on whether the chain is synchronous or asynchronous.
   *
   * @returns Boolean indicating success (or Promise<boolean> for async chains)
   */
  isOk(): T extends P ? Promise<boolean> : boolean;

  /**
   * Checks if the chain contains an error.
   * The return type depends on whether the chain is synchronous or asynchronous.
   *
   * @returns Boolean indicating error (or Promise<boolean> for async chains)
   */
  isError(): T extends P ? Promise<boolean> : boolean;

  /**
   * Extracts the value from the chain.
   * Throws if the chain contains an error.
   * The return type depends on whether the chain is synchronous or asynchronous.
   *
   * @returns The value (or PromiseLike<value> for async chains)
   * @throws The error if present
   */
  unwrap(): T extends P ? PromiseLike<Awaited<T>> : T;

  /**
   * Converts the chain to a Promise.
   * The Promise resolves with the value or rejects with the error.
   * This always returns a Promise regardless of whether the chain is synchronous or asynchronous.
   *
   * @returns Promise that resolves with the value or rejects with the error
   */
  toPromise(): Promise<Awaited<T>>;

  /**
   * @deprecated Use effect() instead
   * Legacy method that applies an effect to the value.
   * Like effect(), errors thrown and Promises returned will propagate through the chain.
   */
  ifOk<U>(
    consumer: (value: Awaited<T>) => U,
  ): T extends P ? SafeChain<PromiseLike<Awaited<U>>> : SafeChain<U>;

  /**
   * @deprecated Use tapError() instead
   * Legacy method that observes an error without affecting the chain.
   */
  ifError(consumer: (error: Error) => any): SafeChain<T>;
}

class SafeChainImpl<T = undefined> implements SafeChain<T> {
  private result: SafeResult<Awaited<T>>;
  private promise?: PromiseLike<any>;

  constructor() {
    this.result = SafeResult.ofOk(undefined) as SafeResult<Awaited<T>>;
  }

  private next<U>(
    cb: (r: Result<Awaited<T>>) => U,
  ): T extends P ? SafeChain<PromiseLike<Awaited<U>>> : SafeChain<U> {
    const instance = new SafeChainImpl<unknown>();

    if (this.promise) {
      // Handle async case
      instance.promise = this.promise
        .then(() => cb(this.result.get()))
        .then(
          (v) => instance.result.ok(v),
          (e) => instance.result.fail(e),
        );
    } else {
      // Handle sync case
      try {
        const next = cb(this.result.get());
        if (isPromiseLike(next)) {
          instance.promise = next.then(
            (v) => instance.result.ok(v),
            (e) => instance.result.fail(e),
          );
        } else {
          instance.result.ok(next);
        }
      } catch (err) {
        instance.result.fail(err);
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

  tap(consumer: (value: Result<Awaited<T>>) => any): SafeChain<T> {
    return this.next((result) => {
      try {
        consumer({ ...result });
      } catch {
        // Ignore any errors from the consumer
      }
      if (result.isError) throw result.error;

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

  // Legacy method, delegates to effect
  ifOk<U>(
    consumer: (value: Awaited<T>) => U,
  ): T extends P ? SafeChain<PromiseLike<Awaited<U>>> : SafeChain<U> {
    return this.effect(consumer) as unknown as T extends P
      ? SafeChain<PromiseLike<Awaited<U>>>
      : SafeChain<U>;
  }

  // Legacy method, delegates to tap
  ifError(consumer: (error: Error) => any): SafeChain<T> {
    return this.tap((result) => {
      if (result.isError) consumer(result.error);
    }) as SafeChain<T>;
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
        return !this.result.get().isError;
      })() as T extends P ? Promise<boolean> : boolean;
    }

    return !this.result.get().isError as T extends P
      ? Promise<boolean>
      : boolean;
  }

  isError(): T extends P ? Promise<boolean> : boolean {
    if (this.promise) {
      return (async () => {
        await this.promise;
        return this.result.get().isError;
      })() as T extends P ? Promise<boolean> : boolean;
    }

    return this.result.get().isError as T extends P
      ? Promise<boolean>
      : boolean;
  }

  unwrap(): T extends P ? PromiseLike<Awaited<T>> : T {
    if (this.promise) {
      return (async () => {
        await this.promise;
        if (this.result.get().isError) throw this.result.get().error;
        return this.result.get().value as T extends P
          ? PromiseLike<Awaited<T>>
          : T;
      })() as T extends P ? PromiseLike<Awaited<T>> : T;
    }

    if (this.result.get().isError) throw this.result.get().error;
    return this.result.get().value as T extends P ? PromiseLike<Awaited<T>> : T;
  }

  toPromise(): Promise<Awaited<T>> {
    if (this.promise) {
      return this.promise.then(() => {
        if (this.result.get().isError)
          return Promise.reject(this.result.get().error);
        return Promise.resolve(this.result.get().value);
      }) as Promise<Awaited<T>>;
    }

    return this.result.get().isError
      ? Promise.reject(this.result.get().error)
      : Promise.resolve(this.result.get().value!);
  }
}

/**
 * Creates a SafeChain from an existing value.
 *
 * @param value The value to wrap in a SafeChain
 * @returns A SafeChain containing the value
 */
export function safeValue<T>(value: T): SafeChain<T> {
  const chain = new SafeChainImpl<T>();
  try {
    return chain.map(() => value) as SafeChain<T>;
  } catch (e) {
    return chain.map(() => {
      throw e;
    }) as SafeChain<T>;
  }
}

export function safeExec<T>(fn: () => T): SafeChain<T> {
  const chain = new SafeChainImpl<T>();
  try {
    return chain.map(() => fn()) as SafeChain<T>;
  } catch (e) {
    return chain.map(() => {
      throw e;
    }) as SafeChain<T>;
  }
}

export function safeEmpty(): SafeChain<undefined> {
  return safeValue(undefined);
}
