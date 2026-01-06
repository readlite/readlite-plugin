import React from "react"
import { act, render, screen } from "@testing-library/react"

import ContentScriptUI from "./content"
import { setupChromeMock, simulateMessage, mockCalls } from "../__mocks__/chrome"

// Mock dependencies
jest.mock("./components/reader/Reader", () => () => (
  <div data-testid="reader-component">Reader Component</div>
))
jest.mock("./context/ReaderContext", () => ({
  ReaderProvider: ({ children }: any) => (
    <div data-testid="reader-provider">{children}</div>
  )
}))
jest.mock("./context/I18nContext", () => ({
  I18nProvider: ({ children }: any) => (
    <div data-testid="i18n-provider">{children}</div>
  )
}))
jest.mock("./utils/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}))
jest.mock("./utils/themeManager", () => ({
  getPreferredTheme: jest.fn().mockReturnValue("light"),
  applyThemeStyles: jest.fn()
}))

describe("ContentScriptUI", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    jest.clearAllMocks()
    setupChromeMock()
    // Clear mock calls manually
    mockCalls.sendMessage.length = 0
  })

  it("renders nothing initially (inactive)", () => {
    const { container } = render(<ContentScriptUI />)
    expect(container.firstChild).toBeNull()
  })

  it("activates reader mode on ACTIVATE_READER message", async () => {
    render(<ContentScriptUI />)

    // Simulate message
    const message = { type: "ACTIVATE_READER" }
    
    act(() => {
      simulateMessage(message)
    })

    // Check if it rendered
    expect(screen.getByTestId("reader-component")).toBeInTheDocument()
  })

  it("deactivates reader mode on DEACTIVATE_READER message", async () => {
    render(<ContentScriptUI />)

    // First activate
    act(() => {
      simulateMessage({ type: "ACTIVATE_READER" })
    })
    expect(screen.getByTestId("reader-component")).toBeInTheDocument()

    // Then deactivate
    act(() => {
      simulateMessage({ type: "DEACTIVATE_READER" })
    })

    expect(screen.queryByTestId("reader-component")).not.toBeInTheDocument()
  })

  it("toggles reader mode on TOGGLE_READER message", async () => {
    render(<ContentScriptUI />)

    // Toggle on
    act(() => {
      simulateMessage({ type: "TOGGLE_READER" })
    })
    expect(screen.getByTestId("reader-component")).toBeInTheDocument()

    // Toggle off
    act(() => {
      simulateMessage({ type: "TOGGLE_READER" })
    })
    expect(screen.queryByTestId("reader-component")).not.toBeInTheDocument()
  })

  it("sends CONTENT_SCRIPT_READY on mount", () => {
    render(<ContentScriptUI />)
    expect(mockCalls.sendMessage).toContainEqual({
      type: "CONTENT_SCRIPT_READY"
    })
  })
})
