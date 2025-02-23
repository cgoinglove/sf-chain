import { isFunction, isPromiseLike } from "./shared";

export interface SafeChain<T> {
  map<U>(
    transform: (value: Awaited<T>) => U,
  ): T extends PromiseLike<any> ? SafeChain<Promise<U>> : SafeChain<U>;
  ifOk<U>(
    consumer: (value: Awaited<T>) => U,
  ): U extends PromiseLike<any> ? SafeChain<Promise<T>> : SafeChain<T>;
  ifError(consumer: (error: Error) => any): SafeChain<T>;
  isOk(): T extends PromiseLike<any> ? Promise<boolean> : boolean;
  isError(): T extends PromiseLike<any> ? Promise<boolean> : boolean;
  unwrap(): T extends PromiseLike<any> ? Promise<T> : T;
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

class Model<T = undefined> implements SafeChain<T> {
  private result: Result<Awaited<T>>;
  private promise?: PromiseLike<void>;

  constructor() {
    this.result = {
      isError: false,
      value: undefined as Awaited<T>,
    };
  }

  protected ok(value: Awaited<T>) {
    this.result = {
      isError: false,
      value,
    };
  }

  private error(error: Error) {
    this.result = {
      isError: true,
      error,
    };
  }

  private next<U>(
    cb: (r: Result<Awaited<T>>) => U,
  ): T extends PromiseLike<any> ? Model<Promise<U>> : Model<U> {
    const instance = new Model<unknown>();
    if (this.promise)
      instance.promise = this.promise
        .then(() => cb(this.result))
        .then(instance.ok.bind(instance), instance.error.bind(instance));
    else {
      try {
        const next = cb(this.result);
        if (isPromiseLike(next))
          instance.promise = next.then(
            instance.ok.bind(instance),
            instance.error.bind(instance),
          );
        else instance.ok(next);
      } catch (err) {
        instance.error(err as Error);
      }
    }
    return instance as T extends PromiseLike<any>
      ? Model<Promise<U>>
      : Model<U>;
  }

  map<U>(
    transform: (value: Awaited<T>) => U,
  ): T extends PromiseLike<any> ? Model<Promise<U>> : Model<U> {
    return this.next((result) => {
      if (result.isError) throw result.error;
      return transform(result.value);
    });
  }

  ifOk<U>(
    consumer: (value: Awaited<T>) => U,
  ): U extends PromiseLike<any> ? Model<Promise<T>> : Model<T> {
    return this.next((result) => {
      if (result.isError) throw result.error;
      const v = consumer(result.value);
      if (isPromiseLike(v)) return v.then(() => result.value);
      return result.value;
    }) as U extends PromiseLike<any> ? Model<Promise<T>> : Model<T>;
  }
  ifError(consumer: (error: Error) => any): Model<T> {
    return this.next((result) => {
      if (result.isError) {
        consumer(result.error);
        throw result.error;
      }
      return result.value;
    }) as Model<T>;
  }
  isOk(): T extends PromiseLike<any> ? Promise<boolean> : boolean {
    if (this.promise)
      return (async () => {
        await this.promise;
        return !this.result.isError;
      })() as T extends PromiseLike<any> ? Promise<boolean> : boolean;

    return !this.result.isError as T extends PromiseLike<any>
      ? Promise<boolean>
      : boolean;
  }
  isError(): T extends PromiseLike<any> ? Promise<boolean> : boolean {
    if (this.promise)
      return (async () => {
        await this.promise;
        return this.result.isError;
      })() as T extends PromiseLike<any> ? Promise<boolean> : boolean;

    return this.result.isError as T extends PromiseLike<any>
      ? Promise<boolean>
      : boolean;
  }
  unwrap(): T extends PromiseLike<any> ? Promise<T> : T {
    if (this.promise)
      return (async () => {
        await this.promise;
        if (this.result.isError) throw this.result.error;
        return this.result.value as T extends PromiseLike<any> ? Promise<T> : T;
      })() as T extends PromiseLike<any> ? Promise<T> : T;

    if (this.result.isError) throw this.result.error;
    return this.result.value as T extends PromiseLike<any> ? Promise<T> : T;
  }
}

export function safeChain<T>(init: () => T): SafeChain<T>;
export function safeChain<T>(init: T): SafeChain<T>;
export function safeChain(): SafeChain<unknown>;
export function safeChain<T>(init?: T | (() => T)): SafeChain<T> {
  const chain = new Model();
  try {
    const value = isFunction(init) ? init() : init;
    return chain.map(() => value as T);
  } catch (e) {
    return chain.map(() => {
      throw e;
    });
  }
}
