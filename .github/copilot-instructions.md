# ReadLite Browser Extension - AI Coding Guide

## Architecture Overview

**Plasmo-based browser extension** for distraction-free reading with shadow DOM isolation.

### Core Data Flow
```
User clicks icon → background.ts (TOGGLE_READER_MODE) → content.tsx (shadow DOM) 
→ ReaderProvider → Reader.tsx → article parsed via parser.ts
```

### Key Files
- `src/background.ts` - Extension icon clicks, tab state tracking via `activeTabsMap`
- `src/content.tsx` - Shadow DOM host, theme sync via `syncThemeToShadow()`
- `src/components/reader/Reader.tsx` - Main UI, 1000+ lines (settings, highlights, export)
- `src/context/ReaderContext.tsx` - Global state: `article`, `settings`, `isLoading`
- `src/utils/parser.ts` - Readability + DOMPurify with strict `SANITIZE_CONFIG` whitelist

### Message Types (background ↔ content)
```typescript
type: "TOGGLE_READER_MODE" | "READER_MODE_CHANGED" | "CONTENT_SCRIPT_READY"
```

## Development Commands

```bash
# CRITICAL: Always build Tailwind first - it's a separate step
npm run dev           # Chrome (includes Tailwind build)
npm run dev:firefox   # Firefox target
npm run build         # Production Chrome
npm run package       # Create store-ready .zip
```

**Testing**: Load `build/chrome-mv3-prod/` as unpacked extension. Check both background console (chrome://extensions → Inspect) and page console.

## Code Conventions

### Imports
```typescript
// Use ~/* alias for src/* paths (tsconfig.json)
import { createLogger } from "~/utils/logger"
```

### Logging (required for new modules)
```typescript
const logger = createLogger("module-name")  // Initialize at file top
logger.info("Message", data)                 // Use throughout
```

### Styling (Tailwind + CSS Variables)
```tsx
// Use theme-aware classes that map to --readlite-* CSS variables
<div className="bg-primary text-primary">    // NOT bg-white
<div className="text-secondary border">      // Theme-adaptive
```

Theme tokens defined in `src/config/theme.ts`, mapped in `tailwind.config.js`.

### Settings Pattern
```typescript
const { settings, updateSettings, isSettingsLoaded } = useStoredSettings()
// Always check isSettingsLoaded before using settings
```

Storage key: `readlite-settings` via `@plasmohq/storage`. Version migrations handled in hook.

## Critical Patterns

### Shadow DOM Isolation
Content script runs in isolated world. Theme changes must propagate via:
1. `applyThemeStyles(shadowRoot, theme)` - Sets CSS variables
2. `syncThemeToShadow()` - Updates wrapper classes + dispatches event

### Content Sanitization
Parser uses strict DOMPurify whitelist. To allow new attributes/tags, update `SANITIZE_CONFIG` in `parser.ts`.

### Highlight Persistence
- `highlightStorage.ts` - Per-URL storage via Plasmo storage
- `highlightAnchor.ts` - Text anchoring for cross-session restoration
- Colors: `beige`, `cyan`, `lavender`, `olive`, `peach`

## i18n
- Source: `locales/{en,zh}/messages.json`
- Access: `const { t } = useI18n()` then `t("keyName")`
- Manifest uses `__MSG_keyName__` format

## Extension Manifest
Defined in `package.json` `manifest` field (Plasmo convention), not separate file. Web-accessible resources include `src/styles/tailwind.output.css`.
