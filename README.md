# ReadLite - Simple Reading Mode

![CI](https://github.com/zhongyiio/readlite/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

A browser extension that provides a clean, distraction-free reading experience.

![ReadLite Icon](assets/icon.png)

## Features

- **Clean Reader Interface**: Transform cluttered web pages into a beautiful, distraction-free reading experience
- **Multiple Themes**: Choose from Light, Dark, Sepia, and Paper themes to suit your preference
- **Adjustable Typography**: Customize font size, line spacing, and width for optimal reading comfort
- **Article Saving**: Save articles as markdown for offline reading
- **Text Highlighting & Notes**: Mark important passages and attach notes for later reference

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/zhongyiio/readlite.git
cd readlite

# Install dependencies
yarn install

# Build the extension
yarn build
```

Then open your browser's extension page (e.g., `chrome://extensions`), enable **Developer mode**, and load the `build/chrome-mv3-prod` folder.

## Usage

1. Install the extension from the Chrome Web Store (coming soon)
2. Navigate to any article or blog post
3. Click the ReadLite icon in your browser toolbar
4. Enjoy a clean reading experience

## Development

### Prerequisites
- Node.js (v16+)
- Yarn or npm

### Setup
```bash
# Clone the repository
git clone https://github.com/zhongyiio/readlite.git
cd readlite

# Install dependencies
yarn install

# Start development server
yarn dev
```

### Testing & Linting
```bash
# Run tests
yarn test

# Check code style
yarn lint
```

### Build for production
```bash
yarn build
```

## Contributing

Pull requests and issues are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

Please run tests and linting before submitting.

## Technical Details

This extension is built with:
- [Plasmo Framework](https://www.plasmo.com/) - Browser extension framework
- [React](https://reactjs.org/) - UI library
- [Mozilla Readability](https://github.com/mozilla/readability) - Content extraction
- [Marked](https://marked.js.org/) - Markdown parsing

## License

MIT

## Languages

- [中文说明](./README.zh.md)