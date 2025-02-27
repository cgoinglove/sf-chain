import { type SafeChain, safeEmpty, safeExec, safeValue } from "./core";
import { safePipe } from "./pipe";
import { isFunction } from "./shared";

/**
 *
 * @param init Optional value or function that returns a value
 * @returns A SafeChain containing the value or function result
 */
function safe<T>(init: () => T): SafeChain<T>;
function safe<T>(init: T): SafeChain<T>;
function safe(): SafeChain<undefined>;
function safe<T>(init?: T | (() => T)): SafeChain<T> {
  if (init === undefined) return safeEmpty() as SafeChain<T>;
  if (isFunction(init)) return safeExec(init);
  return safeValue(init);
}

safe.pipe = safePipe;

export { safe, safePipe, safeValue, SafeChain };
