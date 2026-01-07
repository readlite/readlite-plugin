# ReadLite

A clean, distraction-free reading mode browser extension for web articles.

## Features

- 📖 **Clean Reading Mode** - Extract and display article content without distractions
- 🎨 **Multiple Themes** - Light, Dark, Paper, Eyecare, High Contrast
- ✏️ **Text Highlighting** - Highlight and save important text passages
- ⚙️ **Customizable Display** - Adjust font, size, spacing, width, and alignment
- 🌐 **Multi-language** - Support for English and Chinese
- 📱 **Fullscreen Mode** - Immersive reading experience
- 📤 **Export to Markdown** - Save articles for offline reading

## Installation

### Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

### Build

```bash
# Build for all browsers
bun run build

# Build for specific browser
bun run build:chrome
bun run build:firefox
bun run build:edge

# Create zip package
bun run zip
```

## Tech Stack

- [WXT](https://wxt.dev) - Browser extension framework
- [React](https://react.dev) - UI library
- [TypeScript](https://www.typescriptlang.org) - Type safety
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [@mozilla/readability](https://github.com/mozilla/readability) - Article extraction


## License

MIT
