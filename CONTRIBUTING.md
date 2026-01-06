# Contributing to ReadLite

First off, thanks for taking the time to contribute! ❤️

All types of contributions are encouraged and valued. See the [Table of Contents](#table-of-contents) for different ways to help and details about how this project handles them. Please make sure to read the relevant section before making your contribution. It will make it a lot easier for us maintainers and smooth out the experience for all involved. The community looks forward to your contributions.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [I Have a Question](#i-have-a-question)
- [I Want To Contribute](#i-want-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Your First Code Contribution](#your-first-code-contribution)
- [Styleguides](#styleguides)
  - [Commit Messages](#commit-messages)

## Code of Conduct

This project and everyone participating in it is governed by the [ReadLite Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## I Have a Question

If you want to ask a question, we assume that you have read the available [Documentation](README.md).

Before you ask a question, it is best to search for existing [Issues](https://github.com/zhongyiio/readlite/issues) that might help you. In case you have found a suitable issue and still need clarification, you can write your question in this issue. It is also advisable to search the internet for answers first.

If you then still feel the need to ask a question and need clarification, we recommend the following:

- Open an [Issue](https://github.com/zhongyiio/readlite/issues/new).
- Provide as much context as you can about what you're running into.
- Provide project and platform versions (nodejs, npm, etc), depending on what seems relevant.

## I Want To Contribute

### Reporting Bugs

Before creating bug reports, please check this list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible.

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for ReadLite, **including completely new features and minor improvements to existing functionality**. Following these guidelines will help maintainers and the community to understand your suggestion and find related suggestions.

### Your First Code Contribution

#### Development Setup

1.  **Prerequisites**: Node.js (v16+) and npm/yarn.
2.  **Clone the repo**:
    ```bash
    git clone https://github.com/zhongyiio/readlite.git
    cd readlite
    ```
3.  **Install dependencies**:
    ```bash
    npm install
    # or
    yarn install
    ```
4.  **Start Development Server**:
    ```bash
    # Important: Build Tailwind styles first
    npm run build:tailwind
    
    # Start Plasmo dev server
    npm run dev
    # or for Firefox
    npm run dev:firefox
    ```
5.  **Load Extension**:
    - Chrome: Go to `chrome://extensions`, enable Developer Mode, click "Load unpacked", and select `build/chrome-mv3-dev`.
    - Firefox: Go to `about:debugging`, click "This Firefox", click "Load Temporary Add-on", and select the manifest file in `build/firefox-mv3-dev`.

#### Project Structure

- `src/background.ts`: Background service worker.
- `src/content.tsx`: Content script (runs in Shadow DOM).
- `src/components/`: React components.
- `src/context/`: React contexts (Reader, Theme, I18n).
- `src/utils/parser.ts`: Article extraction logic.

### Styleguides

#### Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

## Join The Project Team

If you are interested in becoming a maintainer, please reach out to us!
