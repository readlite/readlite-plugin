# ReadLite Plugin

ReadLite is a browser extension that provides a clean, distraction-free reading mode for web articles. It extracts the main content of a page and displays it in a customizable, user-friendly interface.

## Project Overview

*   **Type:** Browser Extension (Chrome, Firefox, Edge)
*   **Framework:** [WXT](https://wxt.dev) (Web Extension Tools)
*   **UI Library:** React with TypeScript
*   **Styling:** Tailwind CSS (scoped within Shadow DOM)
*   **Core Logic:** `@mozilla/readability` for content extraction
*   **State Management:** React Context (`ReaderContext`) + Local Storage for settings

## Architecture

The extension injects a React application into the current web page using a Shadow DOM to ensure style isolation.

### Key Components

*   **`entrypoints/content.tsx`**: The main entry point. It creates a Shadow Root, injects global styles (Tailwind), and mounts the React `Reader` component. It also listens for toggle messages.
*   **`entrypoints/background.ts`**: The background service worker. It handles the extension icon state (ON/OFF badge) and facilitates communication between the browser action and the content script.
*   **`components/reader/Reader.tsx`**: The root component of the reading interface. It manages the layout, toolbar, and content rendering.
*   **`context/ReaderContext.tsx`**: Manages global state, including user settings (theme, font size, etc.) and the extracted article data.
*   **`hooks/useArticle.ts`**: (Inferred) Wrapper around `@mozilla/readability` to parse the document and extract content.
*   **`utils/themeManager.ts`**: Handles theme application and switching.

## Development

### Prerequisites

*   Node.js (LTS recommended)
*   Bun (Package Manager)

### Commands

*   **Install Dependencies:** `bun install`
*   **Start Development Server:** `bun run dev` (Hot Module Replacement supported)
*   **Build for Production:**
    *   `bun run build` (Builds for all targets)
    *   `bun run build:chrome`
    *   `bun run build:firefox`
*   **Type Check:** `bun run compile`

### Configuration

*   **`wxt.config.ts`**: WXT configuration, including manifest settings, permissions (`activeTab`, `scripting`, `storage`), and input modules.
*   **`tailwind.config.js`**: Tailwind CSS configuration.
*   **`tsconfig.json`**: TypeScript configuration using `@/*` path aliases.

## Conventions

*   **Style Isolation:** All UI styles are injected into the Shadow DOM to prevent conflicts with the host page.
*   **Components:** Functional React components with hooks.
*   **State:** Preference for React Context for global state and custom hooks for logic encapsulation.
*   **Internationalization:** Uses `@wxt-dev/i18n` with locale files in `locales/`.
