import { vi, describe, test, expect } from "vitest";
import { safeChain } from "../src";

describe("SafeChain 동기 테스트", () => {
  test("동기 map 체인: 값 변환이 올바르게 동작해야 함", () => {
    const chain = safeChain(10).map((value) => value + 5);
    expect(chain.unwrap()).toBe(15);
  });

  test("동기 ifOk: 성공한 경우에만 콜백이 실행되어야 하고 값은 변경되지 않아야 함", () => {
    const mapMock = vi.fn(() => "result");
    const ifErrorMock = vi.fn(() => "error");
    const ifOkMock = vi.fn(() => "ok");
    const chain = safeChain().map(mapMock).ifOk(ifOkMock).ifError(ifErrorMock);
    expect(chain.unwrap()).toBe("result");
    expect(mapMock).toHaveBeenCalledTimes(1);
    expect(ifOkMock).toHaveBeenCalledTimes(1);
    expect(ifErrorMock).toHaveBeenCalledTimes(0);
  });

  test("동기 ifOk: 에러 발생 시 ifOk 콜백은 실행되지 않아야 함", () => {
    const ifErrorMock = vi.fn(() => "error");
    const mapMock = vi.fn(() => "result");
    const ifOkMock = vi.fn(() => "ok");
    const chain = safeChain(() => {
      throw new Error("동기 에러");
      return "";
    })
      .map(mapMock)
      .ifOk(ifOkMock)
      .ifError(ifErrorMock);
    expect(() => chain.unwrap()).toThrow("동기 에러");
    expect(mapMock).toHaveBeenCalledTimes(0);
    expect(ifErrorMock).toHaveBeenCalledTimes(1);
    expect(ifOkMock).toHaveBeenCalledTimes(0);
  });

  test("동기 isOk: 에러가 없으면 true여야 함", () => {
    const chain = safeChain(() => 100);
    expect(chain.isOk()).toBe(true);
  });

  test("동기 isError: 에러가 있으면 true여야 함", () => {
    const chain = safeChain(() => {
      throw new Error("동기 실패");
    });
    expect(() => chain.unwrap()).toThrow("동기 실패");
    expect(chain.isError()).toBe(true);
  });
});

describe("SafeChain 비동기 테스트", () => {
  test("비동기 map 체인: 값 변환이 올바르게 동작해야 함", async () => {
    const chain = safeChain(() => Promise.resolve(10)).map(
      (value) => value + 5,
    );
    expect(await chain.unwrap()).toBe(15);
  });

  test("비동기 ifOk: 성공한 경우에만 콜백이 실행되어야 하고 값은 변경되지 않아야 함", async () => {
    const mapMock = vi.fn(() => Promise.resolve("result"));
    const ifOkMock = vi.fn(() => Promise.resolve("ok"));
    const ifErrorMock = vi.fn(() => Promise.resolve("error"));
    const chain = safeChain(() => Promise.resolve("initial"))
      .map(mapMock)
      .ifOk(ifOkMock)
      .ifError(ifErrorMock);

    expect(await chain.unwrap()).toBe("result");
    expect(mapMock).toHaveBeenCalledTimes(1);
    expect(ifOkMock).toHaveBeenCalledTimes(1);
    expect(ifErrorMock).toHaveBeenCalledTimes(0);
  });

  test("비동기 ifOk: 에러 발생 시 ifOk 콜백은 실행되지 않아야 함", async () => {
    const ifOkMock = vi.fn(() => Promise.resolve("ok"));
    const ifErrorMock = vi.fn(() => Promise.resolve("error"));
    const mapMock = vi.fn(() => Promise.resolve("result"));
    const chain = safeChain(() => Promise.reject(new Error("비동기 에러")))
      .map(mapMock)
      .ifOk(ifOkMock)
      .ifError(ifErrorMock);

    await expect(chain.unwrap()).rejects.toThrow("비동기 에러");
    expect(mapMock).toHaveBeenCalledTimes(0);
    expect(ifOkMock).toHaveBeenCalledTimes(0);
    expect(ifErrorMock).toHaveBeenCalledTimes(1);
  });

  test("비동기 ifError: 정상 실행 시 ifError 콜백은 실행되지 않아야 함", async () => {
    const ifErrorMock = vi.fn(() => Promise.resolve("error"));
    const chain = safeChain(() => Promise.resolve(42)).ifError(ifErrorMock);
    expect(await chain.unwrap()).toBe(42);
    expect(ifErrorMock).toHaveBeenCalledTimes(0);
  });

  test("비동기 isOk: 에러가 없으면 true여야 함", async () => {
    const chain = safeChain(() => Promise.resolve(100));
    expect(await chain.isOk()).toBe(true);
  });

  test("비동기 isError: 에러가 있으면 true여야 함", async () => {
    const chain = safeChain(() => Promise.reject(new Error("비동기 실패")));
    await expect(chain.unwrap()).rejects.toThrow("비동기 실패");
    expect(await chain.isError()).toBe(true);
  });

  test("비동기 ifOk and ifError 함께: 성공 케이스에서 ifOk는 실행되고 ifError는 실행되지 않아야 함", async () => {
    const ifOkMock = vi.fn(() => Promise.resolve("ok"));
    const ifErrorMock = vi.fn(() => Promise.resolve("error"));
    const chain = safeChain(() => Promise.resolve(55))
      .ifOk(ifOkMock)
      .ifError(ifErrorMock);
    expect(await chain.unwrap()).toBe(55);
    expect(ifOkMock).toHaveBeenCalledTimes(1);
    expect(ifOkMock).toHaveBeenCalledWith(55);
    expect(ifErrorMock).toHaveBeenCalledTimes(0);
  });

  test("비동기 ifOk and ifError 함께: 에러 케이스에서 ifError는 실행되고 ifOk는 실행되지 않아야 함", async () => {
    const ifOkMock = vi.fn(() => Promise.resolve("ok"));
    const ifErrorMock = vi.fn(() => Promise.resolve("error"));
    const chain = safeChain(() => Promise.reject(new Error("비동기 에러")))
      .ifOk(ifOkMock)
      .ifError(ifErrorMock);
    await expect(chain.unwrap()).rejects.toThrow("비동기 에러");
    expect(ifOkMock).toHaveBeenCalledTimes(0);
    expect(ifErrorMock).toHaveBeenCalledTimes(1);
  });
});
