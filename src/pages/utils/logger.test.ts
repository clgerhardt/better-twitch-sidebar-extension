import { describe, it, expect, vi, MockInstance, beforeEach, afterEach } from 'vitest'
import { messageLogger } from "./logger";

describe("Logger", () => {
  let spy: MockInstance;
  beforeEach(() => {
    spy = vi.spyOn(console, "log");
  });

  afterEach(() => {
    spy.mockReset();
  });

  it("should log a message with params", () => {
    messageLogger("test", "test message");
    expect(spy).toBeCalledWith("LOGGER: test: test message");
  });

  it("should log a message with an object", () => {
    messageLogger("test", "test message", { test: "test" });
    expect(spy).toBeCalledWith("LOGGER: test: test message : ", { test: "test" });
  });

  it("should log a message with a number", () => {
    messageLogger("test", "test message", 0);
    expect(spy).toBeCalledWith("LOGGER: test: test message : ", "0");
  });

  it("should not log a message if the logger level is not DEBUG", () => {
    import.meta.env.VITE_LOGGER_LEVEL = 'INFO';
    messageLogger("test", "test message");
    expect(spy).not.toBeCalled();
    delete import.meta.env.VITE_LOGGER_LEVEL;
  });
});