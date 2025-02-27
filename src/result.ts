/**
 * Represents any value that can be treated as an error.
 */
type ErrorLike = Error | string | unknown;

export type Result<T = any> =
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

export class SafeResult<T> {
  private _isError = false;
  private value?: T = undefined as unknown as T;
  private error?: Error = undefined;

  static ofOk<U>(value: U): SafeResult<U> {
    return new SafeResult<U>().ok(value);
  }

  static ofFail<U>(error: ErrorLike): SafeResult<U> {
    return new SafeResult<U>().fail(error);
  }

  ok<U>(value: U): SafeResult<U> {
    this._isError = false;
    this.value = value as unknown as T;
    this.error = undefined;
    return this as unknown as SafeResult<U>;
  }

  fail(err: ErrorLike): SafeResult<T> {
    this._isError = true;
    this.value = undefined;
    this.error = this.normalizeError(err);
    return this;
  }

  private normalizeError(error: ErrorLike): Error {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }

  get(): Result<T> {
    if (this._isError) {
      return {
        isError: true,
        error: this.error!,
      };
    } else {
      return {
        isError: false,
        value: this.value!,
      };
    }
  }
}
