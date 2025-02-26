import { describe, it, expect, vi, beforeEach } from "vitest";
import { safe, safeValue, safeExec, safeEmpty } from "../src/core";

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
    it("should call the consumer function with the value", () => {
      const mockFn = vi.fn();
      const result = safe(42).tap(mockFn).unwrap();

      expect(mockFn).toHaveBeenCalledWith(42);
      expect(result).toBe(42);
    });

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

    it("should not call the consumer function if the chain has an error", () => {
      const mockFn = vi.fn();
      const chain = safeExec<number>(() => {
        throw new Error("Chain error");
      }).tap(mockFn);

      expect(mockFn).not.toHaveBeenCalled();
      expect(chain.isError()).toBe(true);
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

  describe("tapError", () => {
    it("should call the consumer function with the error", () => {
      const mockFn = vi.fn();
      const chain = safeExec<number>(() => {
        throw new Error("Test error");
      }).tapError(mockFn);

      expect(mockFn).toHaveBeenCalled();
      expect(mockFn.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(mockFn.mock.calls[0][0].message).toBe("Test error");
      expect(chain.isError()).toBe(true);
    });

    it("should ignore errors thrown in the consumer function", () => {
      const chain = safeExec<number>(() => {
        throw new Error("Original error");
      }).tapError(() => {
        throw new Error("Should be ignored");
      });

      expect(() => chain.unwrap()).toThrow("Original error");
    });

    it("should completely ignore promises from the consumer function", async () => {
      // This should complete immediately without waiting for the promise
      let promiseResolved = false;

      const chain = safeExec<number>(() => {
        throw new Error("Test error");
      }).tapError(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            promiseResolved = true;
            resolve(true);
          }, 50);
        });
      });

      // Should throw immediately without waiting for promise
      expect(() => chain.unwrap()).toThrow("Test error");
      expect(promiseResolved).toBe(false);

      // Wait to ensure the promise does resolve eventually
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(promiseResolved).toBe(true);
    });

    it("should not call the consumer function if the chain has a value", () => {
      const mockFn = vi.fn();
      safe(42).tapError(mockFn).unwrap();

      expect(mockFn).not.toHaveBeenCalled();
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

  describe("Complex chains and real-world usage", () => {
    // Mock functions for testing
    const fetchData = vi.fn((id) => {
      if (id === "invalid") {
        return Promise.reject(new Error("Not found"));
      }
      return Promise.resolve({ id, value: 42 });
    });

    const validateData = vi.fn((data) => {
      if (data.value < 0) {
        throw new Error("Invalid value");
      }
      return data;
    });

    const processData = vi.fn((data) => ({
      ...data,
      processed: true,
      value: data.value * 2,
    }));

    const saveToDatabase = vi.fn((data) => {
      if (data.id === "db-error") {
        return Promise.reject(new Error("Database error"));
      }
      return Promise.resolve({ ...data, saved: true });
    });

    const logSuccess = vi.fn();
    const logError = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should handle a complex processing chain successfully", async () => {
      // Set up timing verification for tap operations
      let tapExecutionTime = 0;
      let tapCompletionTime = 0;

      const now = Date.now();

      const result = await safe("valid-id")
        .map(fetchData)
        .tap(() => {
          tapExecutionTime = Date.now() - now;
          logSuccess("Data fetched");
          // Long running promise that should be ignored
          return new Promise((resolve) =>
            setTimeout(() => {
              tapCompletionTime = Date.now() - now;
              resolve(true);
            }, 50),
          );
        })
        .map(validateData)
        .map(processData)
        .map(saveToDatabase)
        .tap(() => logSuccess("Data saved"))
        .tapError((err) => logError(`Error: ${err.message}`))
        .unwrap();

      // Verify tap immediately executed without waiting for promise
      expect(tapExecutionTime).toBeLessThan(50);

      expect(fetchData).toHaveBeenCalledWith("valid-id");
      expect(validateData).toHaveBeenCalled();
      expect(processData).toHaveBeenCalled();
      expect(saveToDatabase).toHaveBeenCalled();
      expect(logSuccess).toHaveBeenCalledTimes(2);
      expect(logError).not.toHaveBeenCalled();

      expect(result).toEqual({
        id: "valid-id",
        value: 84, // 42 * 2
        processed: true,
        saved: true,
      });

      // Wait to ensure the tap promise did eventually complete
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(tapCompletionTime).toBeGreaterThanOrEqual(50);
    });

    it("should handle fetch errors in complex chains", async () => {
      const chain = safe("invalid")
        .map(fetchData)
        .tap(() => logSuccess("Data fetched"))
        .map(validateData)
        .map(processData)
        .map(saveToDatabase)
        .tap(() => logSuccess("Data saved"))
        .tapError((err) => logError(`Error: ${err.message}`));

      await expect(chain.unwrap()).rejects.toThrow("Not found");

      expect(fetchData).toHaveBeenCalledWith("invalid");
      expect(validateData).not.toHaveBeenCalled();
      expect(processData).not.toHaveBeenCalled();
      expect(saveToDatabase).not.toHaveBeenCalled();
      expect(logSuccess).not.toHaveBeenCalled();
      expect(logError).toHaveBeenCalledWith("Error: Not found");
    });

    it("should handle database errors in complex chains", async () => {
      const chain = safe("db-error")
        .map(fetchData)
        .tap(() => logSuccess("Data fetched"))
        .map(validateData)
        .map(processData)
        .map(saveToDatabase)
        .tap(() => logSuccess("Data saved"))
        .tapError((err) => logError(`Error: ${err.message}`));

      await expect(chain.unwrap()).rejects.toThrow("Database error");

      expect(fetchData).toHaveBeenCalledWith("db-error");
      expect(validateData).toHaveBeenCalled();
      expect(processData).toHaveBeenCalled();
      expect(saveToDatabase).toHaveBeenCalled();
      expect(logSuccess).toHaveBeenCalledTimes(1); // Only first tap should be called
      expect(logError).toHaveBeenCalledWith("Error: Database error");
    });

    it("should recover from errors in complex chains", async () => {
      const result = await safe("invalid")
        .map(fetchData)
        .map(validateData)
        .map(processData)
        .map(saveToDatabase)
        .recover((err) => ({
          id: "fallback",
          value: 0,
          error: err.message,
          recovered: true,
        }))
        .unwrap();

      expect(result).toEqual({
        id: "fallback",
        value: 0,
        error: "Not found",
        recovered: true,
      });
    });

    it("should combine various operations in a complex chain", async () => {
      interface User {
        id: string;
        name: string;
      }
      interface Post {
        id: string;
        title: string;
        content: string;
      }

      const fetchUser = vi.fn(
        (id: string): Promise<User> =>
          id === "missing"
            ? Promise.reject(new Error("User not found"))
            : Promise.resolve({ id, name: "Test User" }),
      );

      const fetchUserPosts = vi.fn(
        (user: User): Promise<Post[]> =>
          user.id === "no-posts"
            ? Promise.resolve([])
            : Promise.resolve([
                { id: "post1", title: "First Post", content: "Content 1" },
                { id: "post2", title: "Second Post", content: "Content 2" },
              ]),
      );

      const processUserAndPosts = vi.fn(
        (data: { user: User; posts: Post[] }) => ({
          ...data,
          postCount: data.posts.length,
          processed: true,
        }),
      );

      const trackAnalytics = vi.fn();
      const logUserActivity = vi.fn();

      // Set up timing verification
      let tapStartTime = 0;
      let longRunningTapCompleted = false;

      // Complex chain with multiple operations and type transformations
      const result = await safe("user123")
        .map(fetchUser)
        .tap((user) => {
          tapStartTime = Date.now();
          logUserActivity(`User ${user.id} fetched`);
          // This long-running promise should be ignored
          return new Promise((resolve) => {
            setTimeout(() => {
              longRunningTapCompleted = true;
              resolve(true);
            }, 50);
          });
        })
        .map(async (user) => {
          const posts = await fetchUserPosts(user);
          return { user, posts };
        })
        .effect((data) => trackAnalytics(`Found ${data.posts.length} posts`))
        .map(processUserAndPosts)
        .recover((err) => ({
          user: { id: "guest", name: "Guest" },
          posts: [],
          postCount: 0,
          error: err.message,
        }))
        .unwrap();

      // Should have continued processing without waiting for the tap promise
      expect(longRunningTapCompleted).toBe(false);
      const processingTime = Date.now() - tapStartTime;
      expect(processingTime).toBeLessThan(50);

      expect(fetchUser).toHaveBeenCalledWith("user123");
      expect(fetchUserPosts).toHaveBeenCalled();
      expect(processUserAndPosts).toHaveBeenCalled();
      expect(trackAnalytics).toHaveBeenCalled();
      expect(logUserActivity).toHaveBeenCalled();

      expect(result).toEqual({
        user: { id: "user123", name: "Test User" },
        posts: [
          { id: "post1", title: "First Post", content: "Content 1" },
          { id: "post2", title: "Second Post", content: "Content 2" },
        ],
        postCount: 2,
        processed: true,
      });

      // Wait to ensure the tap promise does eventually complete
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(longRunningTapCompleted).toBe(true);
    });
  });
});
