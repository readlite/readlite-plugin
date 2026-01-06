import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { useI18n } from "~/context/I18nContext";
import { useReader } from "~/context/ReaderContext";
import { useTheme } from "~/context/ThemeContext";
import { setupChromeMock, mockCalls } from "../../../__mocks__/chrome";

import Reader from "./Reader";

// Mock dependencies
jest.mock("~/context/ReaderContext");
jest.mock("~/context/I18nContext");
jest.mock("~/context/ThemeContext", () => ({
  useTheme: jest.fn(),
  ThemeProvider: ({ children }: any) => <div>{children}</div>,
}));
jest.mock("~/utils/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock("~/utils/export", () => ({
  exportAsMarkdown: jest.fn(),
}));

// Mock child components
jest.mock("../settings/Settings", () => {
  const MockSettings = () => (
    <div data-testid="settings-panel">Settings Panel</div>
  );
  MockSettings.displayName = "MockSettings";
  return MockSettings;
});
jest.mock("./ReaderToolbar", () => ({
  __esModule: true,
  default: ({
    toggleSettings,
    showSettings,
    handleClose,
    handleMarkdownDownload,
    toggleAutoScroll,
    isAutoScrolling,
    toggleFullscreen,
    isFullscreen,
  }: any) => (
    <div data-testid="reader-toolbar">
      <button onClick={toggleSettings} data-testid="toggle-settings-btn">
        Toggle Settings
      </button>
      <button onClick={handleClose} data-testid="close-reader-btn">
        Close
      </button>
      <button
        onClick={handleMarkdownDownload}
        data-testid="download-markdown-btn"
      >
        Download
      </button>
      <button onClick={toggleAutoScroll} data-testid="toggle-autoscroll-btn">
        {isAutoScrolling ? "Stop Scroll" : "Start Scroll"}
      </button>
      <button onClick={toggleFullscreen} data-testid="toggle-fullscreen-btn">
        {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      </button>
      {showSettings && <span data-testid="settings-indicator">Shown</span>}
    </div>
  ),
}));
jest.mock("./ReaderContent", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { forwardRef } = require("react");
  const MockReaderContent = forwardRef(
    (props: unknown, ref: React.Ref<HTMLDivElement>) => (
      <div data-testid="reader-content" ref={ref}>
        <h1>Title</h1>
        <p>Paragraph 1</p>
        <ul>
          <li>List item</li>
        </ul>
        <blockquote>Quote</blockquote>
      </div>
    ),
  );
  MockReaderContent.displayName = "MockReaderContent";
  return {
    __esModule: true,
    default: MockReaderContent,
  };
});
jest.mock("./SelectionToolbar", () => ({
  __esModule: true,
  default: ({ onHighlight, onRemoveHighlight, onCopy, onClose }: any) => (
    <div data-testid="selection-toolbar">
      <button onClick={() => onHighlight("yellow")} data-testid="highlight-btn">
        Highlight
      </button>
      <button
        onClick={() => onRemoveHighlight("id")}
        data-testid="remove-highlight-btn"
      >
        Remove
      </button>
      <button onClick={onCopy} data-testid="copy-btn">
        Copy
      </button>
      <button onClick={onClose} data-testid="close-selection-btn">
        Close Selection
      </button>
    </div>
  ),
}));
jest.mock("../ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: any) => (
    <div data-testid="error-boundary">{children}</div>
  ),
}));

describe("Reader Component", () => {
  const mockLoadArticle = jest.fn();
  const mockT = jest.fn((key) => key);
  const mockSetTheme = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    setupChromeMock();
    (useI18n as jest.Mock).mockReturnValue({ t: mockT });
    (useTheme as jest.Mock).mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
    });
    (useReader as jest.Mock).mockReturnValue({
      article: {
        title: "Test Article",
        content: "<p>Content</p>",
        textContent: "Content",
      },
      settings: {
        theme: "light",
        fontFamily: "sans",
        fontSize: 16,
        lineHeight: 1.5,
        maxWidth: 800,
      },
      isLoading: false,
      error: null,
      loadArticle: mockLoadArticle,
    });
  });

  it("renders loading state", () => {
    (useReader as jest.Mock).mockReturnValue({
      isLoading: true,
      settings: { theme: "light" },
    });

    render(<Reader />);
    expect(screen.getByText("extractingArticle")).toBeInTheDocument();
  });

  it("renders error state", () => {
    (useReader as jest.Mock).mockReturnValue({
      error: "Failed to load",
      settings: { theme: "light" },
    });

    render(<Reader />);
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });

  it("renders reader content and toolbar when loaded", () => {
    render(<Reader />);
    expect(screen.getByTestId("reader-content")).toBeInTheDocument();
    expect(screen.getByTestId("reader-toolbar")).toBeInTheDocument();
  });

  it("toggles settings panel", () => {
    render(<Reader />);

    const toggleBtn = screen.getByTestId("toggle-settings-btn");

    // Initially settings should be hidden
    expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();

    // Click to show
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    expect(screen.getByTestId("settings-indicator")).toBeInTheDocument();

    // Click to hide
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
  });

  it("renders selection toolbar when text is selected", async () => {
    render(<Reader />);

    // Trigger window message
    act(() => {
      window.postMessage(
        {
          type: "TEXT_SELECTED",
          rect: { top: 100, left: 100, width: 50, height: 20 },
          isActive: true,
          selectedText: "Selected Text",
        },
        "*",
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("selection-toolbar")).toBeInTheDocument();
    });
  });

  it("handles close action", () => {
    render(<Reader />);
    const dispatchEventSpy = jest.spyOn(document, "dispatchEvent");

    fireEvent.click(screen.getByTestId("close-reader-btn"));

    expect(mockCalls.sendMessage).toContainEqual(
      expect.objectContaining({ type: "READER_MODE_CHANGED", isActive: false }),
    );
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "READLITE_TOGGLE_INTERNAL" }),
    );
  });

  it("updates reading progress on scroll", () => {
    render(<Reader />);

    // Find the scroll container
    const content = screen.getByTestId("reader-content");
    // The structure in Reader.tsx is:
    // <div className="readlite-reader-container ...">
    //   <div className="flex flex-row ...">
    //     <div ref={readerColumnRef} ...>  <-- This is the scroll container
    //       <ReaderContent ... />

    const scrollContainer = content.parentElement;

    if (scrollContainer) {
      Object.defineProperty(scrollContainer, "scrollTop", {
        value: 500,
        writable: true,
      });
      Object.defineProperty(scrollContainer, "clientHeight", {
        value: 1000,
        writable: true,
      });
      Object.defineProperty(scrollContainer, "scrollHeight", {
        value: 2000,
        writable: true,
      });

      fireEvent.scroll(scrollContainer);
    }
  });

  it("handles markdown download", () => {
    render(<Reader />);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { exportAsMarkdown } = require("~/utils/export");

    fireEvent.click(screen.getByTestId("download-markdown-btn"));

    expect(exportAsMarkdown).toHaveBeenCalled();
  });

  it("handles highlight actions", async () => {
    render(<Reader />);
    const postMessageSpy = jest.spyOn(window, "postMessage");

    // Trigger selection to show toolbar
    act(() => {
      window.postMessage(
        {
          type: "TEXT_SELECTED",
          rect: { top: 100, left: 100, width: 50, height: 20 },
          isActive: true,
          selectedText: "Selected Text",
        },
        "*",
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("selection-toolbar")).toBeInTheDocument();
    });

    // Test highlight
    fireEvent.click(screen.getByTestId("highlight-btn"));
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "HIGHLIGHT_TEXT", color: "yellow" }),
      "*",
    );

    // Test close selection
    fireEvent.click(screen.getByTestId("close-selection-btn"));
    await waitFor(() => {
      expect(screen.queryByTestId("selection-toolbar")).not.toBeInTheDocument();
    });
  });

  it("handles auto-scroll", () => {
    jest.useFakeTimers();
    render(<Reader />);

    // Mock scrollBy on the container
    const content = screen.getByTestId("reader-content");
    const scrollContainer = content.parentElement;
    if (scrollContainer) {
      scrollContainer.scrollBy = jest.fn();
    }

    const toggleBtn = screen.getByTestId("toggle-autoscroll-btn");

    // Start auto-scroll
    fireEvent.click(toggleBtn);
    expect(screen.getByText("Stop Scroll")).toBeInTheDocument();

    // Fast forward time to trigger scroll
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(scrollContainer?.scrollBy).toHaveBeenCalled();

    // Test pause on user scroll
    if (scrollContainer) {
      fireEvent.wheel(scrollContainer);
    }
    expect(screen.getByText("Start Scroll")).toBeInTheDocument();

    jest.useRealTimers();
  });

  it("tracks visible content on scroll", () => {
    jest.useFakeTimers();
    render(<Reader />);

    const content = screen.getByTestId("reader-content");
    const scrollContainer = content.parentElement;

    // Mock getBoundingClientRect for children
    const children = content.querySelectorAll("h1, p, li, blockquote");
    children.forEach((child) => {
      jest.spyOn(child, "getBoundingClientRect").mockReturnValue({
        top: 100,
        bottom: 200,
        height: 100,
        width: 100,
        left: 0,
        right: 100,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
    });

    // Trigger scroll
    if (scrollContainer) {
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } });
    }

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    jest.useRealTimers();
  });

  it("handles fullscreen selection", async () => {
    render(<Reader />);

    // Mock requestFullscreen on the container
    const content = screen.getByTestId("reader-content");
    // ReaderContent -> readerColumn -> flex-row -> readerContainer
    const container = content.parentElement?.parentElement?.parentElement;

    if (container) {
      container.requestFullscreen = jest.fn().mockImplementation(async () => {
        // Simulate browser behavior
        Object.defineProperty(document, "fullscreenElement", {
          configurable: true,
          value: container,
        });
        fireEvent(document, new Event("fullscreenchange"));
      });
    }

    // Enter fullscreen
    fireEvent.click(screen.getByTestId("toggle-fullscreen-btn"));

    await waitFor(() => {
      expect(screen.getByText("Exit Fullscreen")).toBeInTheDocument();
    });

    // Mock selection
    const mockSelection = {
      isCollapsed: false,
      getRangeAt: jest.fn().mockReturnValue({
        getBoundingClientRect: jest.fn().mockReturnValue({
          top: 100,
          left: 100,
          width: 50,
          height: 20,
          bottom: 120,
          right: 150,
        }),
      }),
      rangeCount: 1,
    };

    jest.spyOn(window, "getSelection").mockReturnValue(mockSelection as any);

    // Trigger mouseup
    fireEvent.mouseUp(document);

    await waitFor(() => {
      expect(screen.getByTestId("selection-toolbar")).toBeInTheDocument();
    });
  });
});
