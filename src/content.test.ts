/**
 * Tests for content script functionality
 * Tests message handling and reader mode activation
 */

import {
  setupChromeMock,
  simulateMessage,
  mockCalls,
  resetMockChrome,
} from "../__mocks__/chrome";

// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve({
    text: () => Promise.resolve("/* mocked CSS */"),
  } as Response),
);

// Mock dependencies before importing content script
jest.mock("./components/reader/Reader", () => {
  const MockReader = () => null;
  MockReader.displayName = "MockReader";
  return MockReader;
});
jest.mock("./context/ReaderContext", () => ({
  ReaderProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("./context/I18nContext", () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("./utils/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));
jest.mock("./utils/themeManager", () => ({
  getPreferredTheme: jest.fn().mockReturnValue("light"),
  applyThemeStyles: jest.fn(),
}));
jest.mock("react-dom/client", () => ({
  createRoot: jest.fn(() => ({
    render: jest.fn(),
    unmount: jest.fn(),
  })),
}));

describe("Content Script", () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    document.documentElement.classList.remove("readlite-active");
    document.body.style.overflow = "";

    // Reset chrome mock
    resetMockChrome();
    setupChromeMock();
    mockCalls.sendMessage.length = 0;

    // Reset fetch mock
    (global.fetch as jest.Mock).mockClear();

    // Clear module cache to reinitialize content script
    jest.resetModules();
  });

  afterEach(() => {
    // Clean up any containers
    const container = document.getElementById("readlite-container");
    if (container) {
      container.remove();
    }
    const styles = document.getElementById("readlite-global-styles");
    if (styles) {
      styles.remove();
    }
  });

  it("sends CONTENT_SCRIPT_READY message on initialization", async () => {
    // Import content script (triggers initialization)
    await import("./content");

    // Check if ready message was sent
    expect(mockCalls.sendMessage).toContainEqual({
      type: "CONTENT_SCRIPT_READY",
    });
  });

  it("injects global styles on initialization", async () => {
    await import("./content");

    const styleElement = document.getElementById("readlite-global-styles");
    expect(styleElement).toBeInTheDocument();
    expect(styleElement?.textContent).toContain("readlite-active");
  });

  it("activates reader mode on TOGGLE_READER message", async () => {
    await import("./content");

    // Simulate toggle message
    simulateMessage({ type: "TOGGLE_READER" });

    // Wait for async fetch to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Check if container was created
    const container = document.getElementById("readlite-container");
    expect(container).toBeInTheDocument();
    expect(container?.style.display).toBe("block");
    expect(document.documentElement.classList.contains("readlite-active")).toBe(
      true,
    );
  });

  it("deactivates reader mode on second TOGGLE_READER message", async () => {
    await import("./content");

    // Toggle on
    simulateMessage({ type: "TOGGLE_READER" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.documentElement.classList.contains("readlite-active")).toBe(
      true,
    );

    // Toggle off
    simulateMessage({ type: "TOGGLE_READER" });
    const container = document.getElementById("readlite-container");
    expect(container?.style.display).toBe("none");
    expect(document.documentElement.classList.contains("readlite-active")).toBe(
      false,
    );
  });

  it("responds to ACTIVATE_READER message", async () => {
    await import("./content");

    simulateMessage({ type: "ACTIVATE_READER" });
    await new Promise((resolve) => setTimeout(resolve, 10));

    const container = document.getElementById("readlite-container");
    expect(container).toBeInTheDocument();
    expect(container?.style.display).toBe("block");
  });

  it("responds to DEACTIVATE_READER message when active", async () => {
    await import("./content");

    // First activate
    simulateMessage({ type: "ACTIVATE_READER" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.documentElement.classList.contains("readlite-active")).toBe(
      true,
    );

    // Then deactivate
    simulateMessage({ type: "DEACTIVATE_READER" });
    const container = document.getElementById("readlite-container");
    expect(container?.style.display).toBe("none");
  });

  it("sends READER_MODE_CHANGED message when toggling", async () => {
    await import("./content");

    simulateMessage({ type: "TOGGLE_READER" });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockCalls.sendMessage).toContainEqual({
      type: "READER_MODE_CHANGED",
      isActive: true,
    });
  });

  it("responds to internal toggle event", async () => {
    await import("./content");

    // Dispatch internal toggle event
    document.dispatchEvent(new Event("READLITE_TOGGLE_INTERNAL"));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const container = document.getElementById("readlite-container");
    expect(container).toBeInTheDocument();
    expect(container?.style.display).toBe("block");
  });
});
