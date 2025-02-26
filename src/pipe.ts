import { safe, SafeChain } from "../src/core";

type P = PromiseLike<any>;

type NonDistributive<T> = [T] extends [any] ? T : never;

type HasPromise<T> =
  NonDistributive<T> extends Promise<any>
    ? true
    : (
          T extends any ? (T extends Promise<any> ? true : false) : never
        ) extends false
      ? false
      : true;

type SafeChainCheckPromise<T, U> =
  HasPromise<U> extends true ? SafeChain<Promise<Awaited<T>>> : SafeChain<T>;

/**
 * Type for a function that transforms a SafeChain
 */
export type SafeTransformer<T = any, U = any> = (
  chain: SafeChain<T>,
) => T extends P ? SafeChain<Promise<Awaited<U>>> : SafeChain<U>;

/**
 * Creates a map transformer function.
 *
 * @param transform The transformation function
 * @returns A function that applies the map transformation to a SafeChain
 */
export function map<T, U>(
  transform: (value: Awaited<T>) => U,
): SafeTransformer<T, U> {
  return ((chain: SafeChain<T>) => chain.map(transform)) as SafeTransformer<
    T,
    U
  >;
}

/**
 * Creates a flatMap transformer function.
 *
 * @param transform The transformation function
 * @returns A function that applies the flatMap transformation to a SafeChain
 */
export function flatMap<T, U>(
  transform: (value: Awaited<T>) => SafeChain<U>,
): SafeTransformer<T, U> {
  return ((chain: SafeChain<T>) => chain.flatMap(transform)) as SafeTransformer<
    T,
    U
  >;
}

/**
 * Creates a tap transformer function.
 *
 * @param consumer The consumer function
 * @returns A function that applies the tap operation to a SafeChain
 */
export function tap<T, U>(
  consumer: (value: Awaited<T>) => U,
): SafeTransformer<T, T> {
  return ((chain: SafeChain<T>) => chain.tap(consumer)) as SafeTransformer<
    T,
    T
  >;
}

/**
 * Creates an effect transformer function.
 *
 * @param effectFn The effect function
 * @returns A function that applies the effect operation to a SafeChain
 */
export function effect<T, U>(
  effectFn: (value: Awaited<T>) => U,
): SafeTransformer<U, T> {
  return ((chain: SafeChain<any>) => chain.effect(effectFn)) as SafeTransformer<
    U,
    T
  >;
}

/**
 * Creates a tapError transformer function.
 *
 * @param consumer The error consumer function
 * @returns A function that applies the tapError operation to a SafeChain
 */
export function tapError<T, U>(
  consumer: (error: Error) => U,
): SafeTransformer<T, T> {
  return ((chain: SafeChain<T>) => chain.tapError(consumer)) as SafeTransformer<
    T,
    T
  >;
}

/**
 * Creates a recover transformer function.
 *
 * @param handler The recovery handler function
 * @returns A function that applies the recovery operation to a SafeChain
 */
export function recover<T, U>(
  handler: (error: Error) => U,
): SafeTransformer<T, U> {
  return ((chain: SafeChain<T>) => chain.recover(handler)) as SafeTransformer<
    T,
    U
  >;
}

export function safePipe<A, B>(
  ab: SafeTransformer<A, B>,
): (input: A) => SafeChainCheckPromise<B, A>;

export function safePipe<A, B, C>(
  ab: SafeTransformer<A, B>,
  bc: SafeTransformer<B, C>,
): (input: A) => SafeChainCheckPromise<C, A | B>;
export function safePipe<A, B, C, D>(
  ab: SafeTransformer<A, B>,
  bc: SafeTransformer<B, C>,
  cd: SafeTransformer<C, D>,
): (input: A) => SafeChainCheckPromise<D, A | B | C>;
export function safePipe<A, B, C, D, E>(
  ab: SafeTransformer<A, B>,
  bc: SafeTransformer<B, C>,
  cd: SafeTransformer<C, D>,
  de: SafeTransformer<D, E>,
): (input: A) => SafeChainCheckPromise<E, A | B | C | D>;

export function safePipe<A, B, C, D, E, F>(
  ab: SafeTransformer<A, B>,
  bc: SafeTransformer<B, C>,
  cd: SafeTransformer<C, D>,
  de: SafeTransformer<D, E>,
  ef: SafeTransformer<E, F>,
): (input: A) => SafeChainCheckPromise<F, A | B | C | D | E>;

export function safePipe<A, B, C, D, E, F, G>(
  ab: SafeTransformer<A, B>,
  bc: SafeTransformer<B, C>,
  cd: SafeTransformer<C, D>,
  de: SafeTransformer<D, E>,
  ef: SafeTransformer<E, F>,
  fg: SafeTransformer<F, G>,
): (input: A) => SafeChainCheckPromise<G, A | B | C | D | E | F>;
export function safePipe<A, B, C, D, E, F, G, H>(
  ab: SafeTransformer<A, B>,
  bc: SafeTransformer<B, C>,
  cd: SafeTransformer<C, D>,
  de: SafeTransformer<D, E>,
  ef: SafeTransformer<E, F>,
  fg: SafeTransformer<F, G>,
  gh: SafeTransformer<G, H>,
): (input: A) => SafeChainCheckPromise<H, A | B | C | D | E | F | G>;
export function safePipe<A, B, C, D, E, F, G, H, I>(
  ab: SafeTransformer<A, B>,
  bc: SafeTransformer<B, C>,
  cd: SafeTransformer<C, D>,
  de: SafeTransformer<D, E>,
  ef: SafeTransformer<E, F>,
  fg: SafeTransformer<F, G>,
  gh: SafeTransformer<G, H>,
  hi: SafeTransformer<H, I>,
): (input: A) => SafeChainCheckPromise<I, A | B | C | D | E | F | G | H>;
export function safePipe(
  ...transformers: Array<(chain: SafeChain<any>) => SafeChain<any>>
): (input: any) => SafeChain<any> {
  return (input: any) => {
    const initialChain = transformers[0](safe(input));
    return transformers
      .slice(1)
      .reduce((chain, transformer) => transformer(chain), initialChain);
  };
}
