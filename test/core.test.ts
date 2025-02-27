import { describe, it, expect, vi } from "vitest";
import { safeValue, safeExec, safeEmpty } from "../src/core";
import { safe } from "../src";

const FOURCE: boolean = true;

describe("SafeChain", () => {
  describe("Constructor functions", () => {
    it("safeValue should create a SafeChain with the given value", () => {
      const result = safeValue(42).unwrap();
      expect(result).toBe(42);
    });

    it("safeExec should execute a function and capture its result", () => {
      const result = safeExec(() => 42).unwrap();
      expect(result).toBe(42);
    });

    it("safeExec should capture thrown errors", () => {
      const chain = safeExec(() => {
        throw new Error("Test error");
      });
      expect(chain.isError()).toBe(true);
      expect(() => chain.unwrap()).toThrow("Test error");
    });

    it("safeEmpty should create a SafeChain with undefined value", () => {
      const result = safeEmpty().unwrap();
      expect(result).toBeUndefined();
    });

    it("safe should handle different parameter types", () => {
      expect(safe(42).unwrap()).toBe(42);
      expect(safe(() => 42).unwrap()).toBe(42);
      expect(safe().unwrap()).toBeUndefined();
    });
  });

  describe("map", () => {
    it("should transform a success value", () => {
      const result = safe(2)
        .map((x) => x * 2)
        .unwrap();
      expect(result).toBe(4);
    });

    it("should propagate errors", () => {
      const chain = safeExec(() => {
        if (FOURCE) throw new Error("Initial error");
      }).map((x) => x);
      expect(chain.isError()).toBe(true);
    });

    it("should capture errors thrown in the transform function", () => {
      const chain = safe(2).map(() => {
        throw new Error("Transform error");
      });
      expect(chain.isError()).toBe(true);
      expect(() => chain.unwrap()).toThrow("Transform error");
    });

    it("should handle promises correctly", async () => {
      const result = await safe(2)
        .map((x) => Promise.resolve(x * 2))
        .unwrap();
      expect(result).toBe(4);
    });

    it("should handle async functions correctly", async () => {
      const result = await safe(2)
        .map(async (x) => x * 2)
        .unwrap();
      expect(result).toBe(4);
    });

    it("should handle promise rejections", async () => {
      const chain = safe(2).map(() =>
        Promise.reject(new Error("Promise error")),
      );
      await expect(chain.unwrap()).rejects.toThrow("Promise error");
    });
  });

  describe("flatMap", () => {
    it("should flatten nested SafeChains", () => {
      const result = safe(2)
        .flatMap((x) => safe(x * 2))
        .unwrap();
      expect(result).toBe(4);
    });

    it("should propagate errors from the outer chain", () => {
      const chain = safeExec<number>(() => {
        throw new Error("Outer error");
      }).flatMap((x) => safe(x * 2));
      expect(chain.isError()).toBe(true);
    });

    it("should propagate errors from the inner chain", () => {
      const chain = safe(2).flatMap(() =>
        safeExec(() => {
          throw new Error("Inner error");
        }),
      );
      expect(chain.isError()).toBe(true);
    });

    it("should handle async operations properly", async () => {
      const result = await safe(2)
        .flatMap((x) => safe(Promise.resolve(x * 2)))
        .unwrap();
      expect(result).toBe(4);
    });
  });

  describe("tap", () => {
    it("should ignore errors thrown in the consumer function", () => {
      const result = safe(42)
        .tap(() => {
          throw new Error("Should be ignored");
        })
        .unwrap();

      expect(result).toBe(42);
    });

    it("should completely ignore promises from the consumer function", async () => {
      // This should complete immediately without waiting for the promise
      let promiseResolved = false;

      const chain = safe(42).tap(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            promiseResolved = true;
            resolve(true);
          }, 50);
        });
      });

      // The chain should complete immediately without waiting
      const result = chain.unwrap();
      expect(result).toBe(42);
      expect(promiseResolved).toBe(false);

      // Wait to ensure the promise does resolve eventually
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(promiseResolved).toBe(true);
    });

    it("should maintain chain value when tap returns a different value", () => {
      const result = safe(42)
        .tap(() => "different value")
        .unwrap();

      expect(result).toBe(42);
    });
  });

  describe("effect", () => {
    it("should call the effect function with the value", () => {
      const mockFn = vi.fn();
      const result = safe(42).effect(mockFn).unwrap();

      expect(mockFn).toHaveBeenCalledWith(42);
      expect(result).toBe(42);
    });

    it("should propagate errors thrown in the effect function", () => {
      const chain = safe(42).effect(() => {
        if (FOURCE) throw new Error("Effect error");
      });

      expect(chain.isError()).toBe(true);
      expect(() => chain.unwrap()).toThrow("Effect error");
    });

    it("should propagate rejected promises from the effect function", async () => {
      const chain = safe(42).effect(() =>
        Promise.reject(new Error("Effect error")),
      );

      await expect(chain.unwrap()).rejects.toThrow("Effect error");
    });

    it("should not call the effect function if the chain has an error", () => {
      const mockFn = vi.fn();
      const chain = safeExec<number>(() => {
        throw new Error("Chain error");
      }).effect(mockFn);

      expect(mockFn).not.toHaveBeenCalled();
      expect(chain.isError()).toBe(true);
    });

    it("should handle async effects properly", async () => {
      // Using a setTimeout promise to ensure we're testing real async behavior
      let effectExecuted = false;

      const chain = safe(42).effect(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            effectExecuted = true;
            resolve("different value");
          }, 10);
        });
      });

      // Should wait for the promise to resolve
      const result = await chain.unwrap();
      expect(result).toBe(42);
      expect(effectExecuted).toBe(true);
    });

    it("should maintain original chain value when effect returns a different value", () => {
      const result = safe(42)
        .effect(() => "different value")
        .unwrap();

      expect(result).toBe(42);
    });
  });

  describe("recover", () => {
    it("should replace an error with a recovery value", () => {
      const result = safeExec<number>(() => {
        throw new Error("Test error");
      })
        .recover(() => 42)
        .unwrap();

      expect(result).toBe(42);
    });

    it("should not affect chains with success values", () => {
      const result = safe(24)
        .recover(() => 42)
        .unwrap();
      expect(result).toBe(24);
    });

    it("should capture errors thrown in the recovery function", () => {
      const chain = safeExec<number>(() => {
        throw new Error("Original error");
      }).recover(() => {
        throw new Error("Recovery error");
      });

      expect(() => chain.unwrap()).toThrow("Recovery error");
    });

    it("should handle async recovery values", async () => {
      const result = await safeExec<number>(() => {
        throw new Error("Test error");
      })
        .recover(() => Promise.resolve(42))
        .unwrap();

      expect(result).toBe(42);
    });

    it("should handle rejected promises in recovery function", async () => {
      const chain = safeExec<number>(() => {
        throw new Error("Original error");
      }).recover(() => Promise.reject(new Error("Recovery error")));

      await expect(chain.unwrap()).rejects.toThrow("Recovery error");
    });
  });

  describe("isOk and isError", () => {
    it("isOk should return true for success values", () => {
      expect(safe(42).isOk()).toBe(true);
    });

    it("isOk should return false for errors", () => {
      expect(
        safeExec(() => {
          throw new Error("Test");
        }).isOk(),
      ).toBe(false);
    });

    it("isError should return true for errors", () => {
      expect(
        safeExec(() => {
          throw new Error("Test");
        }).isError(),
      ).toBe(true);
    });

    it("isError should return false for success values", () => {
      expect(safe(42).isError()).toBe(false);
    });

    it("isOk and isError should handle async operations", async () => {
      const asyncChain = safe(Promise.resolve(42));
      expect(await asyncChain.isOk()).toBe(true);
      expect(await asyncChain.isError()).toBe(false);

      const errorChain = safe(Promise.reject(new Error("Async error")));
      expect(await errorChain.isOk()).toBe(false);
      expect(await errorChain.isError()).toBe(true);
    });
  });

  describe("unwrap", () => {
    it("should return the success value", () => {
      expect(safe(42).unwrap()).toBe(42);
    });

    it("should throw the error", () => {
      expect(() =>
        safeExec(() => {
          throw new Error("Test");
        }).unwrap(),
      ).toThrow("Test");
    });

    it("should handle promises correctly", async () => {
      const result = await safe(Promise.resolve(42)).unwrap();
      expect(result).toBe(42);
    });

    it("should handle nested promises correctly", async () => {
      const result = await safe(Promise.resolve(Promise.resolve(42))).unwrap();
      expect(result).toBe(42);
    });
  });

  describe("toPromise", () => {
    it("should resolve with the success value", async () => {
      await expect(safe(42).toPromise()).resolves.toBe(42);
    });

    it("should reject with the error", async () => {
      await expect(
        safeExec(() => {
          throw new Error("Test");
        }).toPromise(),
      ).rejects.toThrow("Test");
    });

    it("should handle nested promises correctly", async () => {
      const result = await safe(
        Promise.resolve(Promise.resolve(42)),
      ).toPromise();
      expect(result).toBe(42);
    });
  });

  describe("Legacy methods", () => {
    it("ifOk should behave like effect", () => {
      const mockFn = vi.fn();
      const result = safe(42).ifOk(mockFn).unwrap();

      expect(mockFn).toHaveBeenCalledWith(42);
      expect(result).toBe(42);
    });

    it("ifError should behave like tapError", () => {
      const mockFn = vi.fn();
      const chain = safeExec<number>(() => {
        throw new Error("Test error");
      }).ifError(mockFn);

      expect(mockFn).toHaveBeenCalled();
      expect(mockFn.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(mockFn.mock.calls[0][0].message).toBe("Test error");
      expect(chain.isError()).toBe(true);
    });

    it("should handle promises with legacy methods like their modern counterparts", async () => {
      // For ifOk (like effect), promises should be waited for
      let effectExecuted = false;

      const chain = safe(42).ifOk(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            effectExecuted = true;
            resolve(true);
          }, 10);
        });
      });

      await chain.unwrap();
      expect(effectExecuted).toBe(true);

      // For ifError (like tapError), promises should be ignored
      let errorHandlerPromiseResolved = false;

      const errorChain = safeExec<number>(() => {
        throw new Error("Test error");
      }).ifError(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            errorHandlerPromiseResolved = true;
            resolve(true);
          }, 50);
        });
      });

      expect(() => errorChain.unwrap()).toThrow("Test error");
      expect(errorHandlerPromiseResolved).toBe(false);
    });
  });

  describe("Promise type inference and nested promises", () => {
    it("should handle promise chains correctly", async () => {
      const result = await safe(2)
        .map((x) => Promise.resolve(x * 2))
        .map(async (x) => (await x) + 1)
        .unwrap();

      expect(result).toBe(5);
    });

    it("should handle deeply nested promises", async () => {
      const result = await safe(2)
        .map((x) => Promise.resolve(Promise.resolve(x * 2)))
        .map(async (x) => {
          const resolved = await x;
          return resolved + 1;
        })
        .unwrap();

      expect(result).toBe(5);
    });

    it("should preserve Promise type through the chain", async () => {
      type User = { id: number; name: string };
      const fetchUser = (id: number): Promise<User> =>
        Promise.resolve({ id, name: "Test User" });

      const updateUser = (user: User): Promise<User> =>
        Promise.resolve({ ...user, name: "Updated User" });

      const result = await safe(1)
        .map(fetchUser) // Promise<User>
        .map(updateUser) // Promise<User> (no double Promise)
        .map(async (user) => {
          const updated = await user;
          return { ...updated, verified: true };
        })
        .unwrap();

      expect(result).toEqual({ id: 1, name: "Updated User", verified: true });
    });
  });

  describe("Error normalization", () => {
    it("should convert string errors to Error objects", () => {
      const chain = safeExec(() => {
        throw "String error" as any;
      });

      expect(() => chain.unwrap()).toThrow();
      expect(chain.isError()).toBe(true);
    });

    it("should convert unknown errors to Error objects", () => {
      const chain = safeExec(() => {
        throw { custom: "error" } as any;
      });

      expect(chain.isError()).toBe(true);
      expect(() => chain.unwrap()).toThrow();
    });
  });
});
