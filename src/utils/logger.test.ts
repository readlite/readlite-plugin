/**
 * Unit tests for logger utility
 */

import { createLogger, setLogLevel, LogLevel } from "./logger";

// Store original NODE_ENV
const originalNodeEnv = process.env.NODE_ENV;

// Mock console methods
const mockConsole = {
  error: jest.spyOn(console, "error").mockImplementation(),
  warn: jest.spyOn(console, "warn").mockImplementation(),
  info: jest.spyOn(console, "info").mockImplementation(),
  debug: jest.spyOn(console, "debug").mockImplementation(),
};

describe("Logger Utils", () => {
  beforeEach(() => {
    // Reset log level to default (INFO)
    setLogLevel(LogLevel.INFO);
    // Reset all mock call history
    Object.values(mockConsole).forEach((mock) => mock.mockClear());
    // Ensure not in production mode for most tests
    process.env.NODE_ENV = "development";
  });

  afterAll(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
    // Restore console methods
    Object.values(mockConsole).forEach((mock) => mock.mockRestore());
  });

  describe("createLogger", () => {
    it("creates a logger with all log methods", () => {
      const logger = createLogger("test-module");

      expect(logger).toHaveProperty("error");
      expect(logger).toHaveProperty("warn");
      expect(logger).toHaveProperty("info");
      expect(logger).toHaveProperty("debug");

      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });

    it("formats messages with namespace prefix", () => {
      const logger = createLogger("my-module");
      logger.info("Test message");

      expect(mockConsole.info).toHaveBeenCalledWith("[my-module] Test message");
    });

    it("passes additional arguments to console methods", () => {
      const logger = createLogger("test");
      const extraData = { foo: "bar" };
      const extraArray = [1, 2, 3];

      logger.info("Message with data", extraData, extraArray);

      expect(mockConsole.info).toHaveBeenCalledWith(
        "[test] Message with data",
        extraData,
        extraArray,
      );
    });
  });

  describe("Log Levels", () => {
    describe("LogLevel.ERROR (0)", () => {
      beforeEach(() => {
        setLogLevel(LogLevel.ERROR);
      });

      it("logs error messages", () => {
        const logger = createLogger("test");
        logger.error("Error message");
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
      });

      it("does not log warn messages", () => {
        const logger = createLogger("test");
        logger.warn("Warning message");
        expect(mockConsole.warn).not.toHaveBeenCalled();
      });

      it("does not log info messages", () => {
        const logger = createLogger("test");
        logger.info("Info message");
        expect(mockConsole.info).not.toHaveBeenCalled();
      });

      it("does not log debug messages", () => {
        const logger = createLogger("test");
        logger.debug("Debug message");
        expect(mockConsole.debug).not.toHaveBeenCalled();
      });
    });

    describe("LogLevel.WARN (1)", () => {
      beforeEach(() => {
        setLogLevel(LogLevel.WARN);
      });

      it("logs error messages", () => {
        const logger = createLogger("test");
        logger.error("Error message");
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
      });

      it("logs warn messages", () => {
        const logger = createLogger("test");
        logger.warn("Warning message");
        expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      });

      it("does not log info messages", () => {
        const logger = createLogger("test");
        logger.info("Info message");
        expect(mockConsole.info).not.toHaveBeenCalled();
      });

      it("does not log debug messages", () => {
        const logger = createLogger("test");
        logger.debug("Debug message");
        expect(mockConsole.debug).not.toHaveBeenCalled();
      });
    });

    describe("LogLevel.INFO (2) - default", () => {
      beforeEach(() => {
        setLogLevel(LogLevel.INFO);
      });

      it("logs error messages", () => {
        const logger = createLogger("test");
        logger.error("Error message");
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
      });

      it("logs warn messages", () => {
        const logger = createLogger("test");
        logger.warn("Warning message");
        expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      });

      it("logs info messages", () => {
        const logger = createLogger("test");
        logger.info("Info message");
        expect(mockConsole.info).toHaveBeenCalledTimes(1);
      });

      it("does not log debug messages", () => {
        const logger = createLogger("test");
        logger.debug("Debug message");
        expect(mockConsole.debug).not.toHaveBeenCalled();
      });
    });

    describe("LogLevel.DEBUG (3)", () => {
      beforeEach(() => {
        setLogLevel(LogLevel.DEBUG);
      });

      it("logs error messages", () => {
        const logger = createLogger("test");
        logger.error("Error message");
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
      });

      it("logs warn messages", () => {
        const logger = createLogger("test");
        logger.warn("Warning message");
        expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      });

      it("logs info messages", () => {
        const logger = createLogger("test");
        logger.info("Info message");
        expect(mockConsole.info).toHaveBeenCalledTimes(1);
      });

      it("logs debug messages", () => {
        const logger = createLogger("test");
        logger.debug("Debug message");
        expect(mockConsole.debug).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("setLogLevel", () => {
    it("changes the global log level", () => {
      const logger = createLogger("test");

      // Initially at INFO level
      setLogLevel(LogLevel.INFO);
      logger.debug("Debug 1");
      expect(mockConsole.debug).not.toHaveBeenCalled();

      // Change to DEBUG level
      setLogLevel(LogLevel.DEBUG);
      logger.debug("Debug 2");
      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
    });

    it("affects all loggers globally", () => {
      const logger1 = createLogger("module1");
      const logger2 = createLogger("module2");

      setLogLevel(LogLevel.ERROR);

      logger1.info("Info 1");
      logger2.info("Info 2");

      expect(mockConsole.info).not.toHaveBeenCalled();
    });
  });

  describe("Multiple loggers", () => {
    it("can create multiple independent loggers with different namespaces", () => {
      const logger1 = createLogger("module-a");
      const logger2 = createLogger("module-b");

      logger1.info("Message from A");
      logger2.info("Message from B");

      expect(mockConsole.info).toHaveBeenCalledWith(
        "[module-a] Message from A",
      );
      expect(mockConsole.info).toHaveBeenCalledWith(
        "[module-b] Message from B",
      );
    });
  });

  describe("LogLevel enum", () => {
    it("has correct numeric values", () => {
      expect(LogLevel.ERROR).toBe(0);
      expect(LogLevel.WARN).toBe(1);
      expect(LogLevel.INFO).toBe(2);
      expect(LogLevel.DEBUG).toBe(3);
    });
  });
});
