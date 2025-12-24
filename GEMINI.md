# ReadLite Plugin - Gemini Context

## Project Overview

**ReadLite** is a Chrome browser extension built with the [Plasmo Framework](https://www.plasmo.com/) that provides a clean, distraction-free reading experience. It features AI-powered summarization, translation, and highlighting capabilities.

### Key Technologies
*   **Framework:** Plasmo (Browser Extension Framework)
*   **UI Library:** React 18
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS (with `postcss` and `autoprefixer`)
*   **Content Parsing:** `@mozilla/readability`
*   **Markdown:** `marked`, `turndown`
*   **State Management:** `@plasmohq/storage`, React Context
*   **LLM Integration:** Custom implementation connecting to `api.readlite.app` (OpenRouter wrapper)

### Architecture

1.  **Background Service Worker (`src/background.ts`):**
    *   Handles extension lifecycle events.
    *   Manages Authentication (Google OAuth2 via `identity` permission).
    *   Proxy for LLM API requests to avoid CORS/Content Security Policy issues in content scripts.
    *   Maintains global state (active tabs, available models).
    *   Uses `chrome.runtime.onConnect` for reliable LLM streaming via ports.

2.  **Content Script (`src/content.tsx`):**
    *   Injected into web pages (`<all_urls>`).
    *   Creates an `iframe` (`#readlite-iframe-container`) to host the Reader UI, ensuring style isolation.
    *   Communication with Background script via `chrome.runtime.sendMessage`.
    *   Toggles the Reader view and handles the "original page" visibility.

3.  **UI Components (`src/components/`):**
    *   **Core:** `Reader.tsx` is the main entry point for the Reader view.
    *   **Agent:** Components for the AI chat interface (`AgentUI`, `MessageList`, etc.).
    *   **Settings:** User preferences for typography, theme, etc.

4.  **LLM Integration (`src/utils/llm.ts`):**
    *   Direct fetch implementation to `api.readlite.app`.
    *   Supports streaming responses.
    *   Handles token management and error states.

## Build and Run

### Prerequisites
*   Node.js (v16+)
*   npm or yarn

### Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start development server (hot-reload). |
| `npm run build` | Build for production. |
| `npm run package` | Build and zip the extension for the store. |
| `npm run test` | Run tests (Jest). |
| `npm run lint` | Run ESLint. |
| `npm run format` | Format code with Prettier. |

**Note:** `npm run dev` and `npm run build` automatically run `npm run build:tailwind` to generate the CSS.

## Development Conventions

*   **Styling:** Use Tailwind CSS classes. The project uses a custom `StyleIsolator` (iframe) approach, so global styles shouldn't bleed.
*   **State:** Use React Context for UI state (ReaderContext, I18nContext, etc.) and Plasmo Storage for persistent settings.
*   **Type Safety:** Strict TypeScript rules are enforced (`noImplicitAny`, etc.).
*   **Components:** Functional components with Hooks.
*   **Formatting:** Prettier is used for code formatting.

## Key Files & Directories

*   `src/background.ts`: Main background logic.
*   `src/content.tsx`: Content script entry point.
*   `src/utils/llm.ts`: LLM API client implementation.
*   `src/components/core/Reader.tsx`: Main Reader UI component.
*   `src/config/theme.ts`: Theme definitions (Light, Dark, Sepia, etc.).
*   `assets/`: Icons and static resources.
*   `.plasmo/`: Plasmo build artifacts (git-ignored).
