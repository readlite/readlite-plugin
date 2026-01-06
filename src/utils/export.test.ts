/**
 * Unit tests for export utilities
 */

import { generateFilename, htmlToMarkdown } from "./export";

// Mock logger
jest.mock("~/utils/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe("Export Utils", () => {
  describe("generateFilename", () => {
    // Mock Date.now for consistent timestamps
    const originalDateNow = Date.now;
    const mockTimestamp = new Date("2024-01-15T10:30:45.000Z").getTime();

    beforeEach(() => {
      jest
        .spyOn(Date.prototype, "toISOString")
        .mockReturnValue("2024-01-15T10:30:45.000Z");
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("generates filename with extension", () => {
      const filename = generateFilename("My Article", "md");
      expect(filename).toMatch(/My_Article_\d+\.md$/);
    });

    it("replaces spaces with underscores", () => {
      const filename = generateFilename("Article With Spaces", "md");
      expect(filename).toContain("Article_With_Spaces");
    });

    it("removes invalid filename characters", () => {
      const filename = generateFilename('File: Test <script> "quotes"', "md");
      expect(filename).not.toMatch(/[\\/:*?"<>|]/);
    });

    it("handles multiple consecutive underscores", () => {
      const filename = generateFilename("Title   with   spaces", "md");
      expect(filename).not.toContain("__");
    });

    it("truncates long titles to 100 characters", () => {
      const longTitle = "A".repeat(150);
      const filename = generateFilename(longTitle, "md");
      // Should be truncated title + underscore + timestamp + extension
      const baseName = filename
        .replace(/\.md$/, "")
        .split("_")
        .slice(0, -1)
        .join("_");
      expect(baseName.length).toBeLessThanOrEqual(100);
    });

    it("provides default filename for empty title", () => {
      const filename = generateFilename("", "md");
      expect(filename).toMatch(/^article_\d+\.md$/);
    });

    it("provides default filename for whitespace-only title", () => {
      const filename = generateFilename("   ", "md");
      expect(filename).toMatch(/^article_\d+\.md$/);
    });

    it("adds timestamp to ensure uniqueness", () => {
      const filename = generateFilename("Test", "md");
      // Timestamp should be 14 digits
      expect(filename).toMatch(/_\d{14}\.md$/);
    });

    it("trims whitespace from title", () => {
      const filename = generateFilename("  Trimmed Title  ", "md");
      expect(filename).toContain("Trimmed_Title");
    });

    it("works with different extensions", () => {
      expect(generateFilename("Test", "txt")).toMatch(/\.txt$/);
      expect(generateFilename("Test", "html")).toMatch(/\.html$/);
      expect(generateFilename("Test", "json")).toMatch(/\.json$/);
    });

    it("removes non-alphanumeric characters except dots and hyphens", () => {
      const filename = generateFilename("Test@#$%File", "md");
      expect(filename).not.toMatch(/[@#$%]/);
    });

    it("preserves hyphens in title", () => {
      const filename = generateFilename("Test-Article-Title", "md");
      expect(filename).toContain("Test-Article-Title");
    });
  });

  describe("htmlToMarkdown", () => {
    it("converts paragraph tags to text", () => {
      const html = "<p>Hello World</p>";
      const md = htmlToMarkdown(html);
      expect(md.trim()).toBe("Hello World");
    });

    it("converts headings correctly", () => {
      const html = "<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>";
      const md = htmlToMarkdown(html);
      expect(md).toContain("# Title");
      expect(md).toContain("## Subtitle");
      expect(md).toContain("### Section");
    });

    it("converts bold text", () => {
      const html = "<p><strong>Bold text</strong></p>";
      const md = htmlToMarkdown(html);
      expect(md).toContain("**Bold text**");
    });

    it("converts italic text", () => {
      const html = "<p><em>Italic text</em></p>";
      const md = htmlToMarkdown(html);
      expect(md).toContain("*Italic text*");
    });

    it("converts links", () => {
      const html = '<p><a href="https://example.com">Link text</a></p>';
      const md = htmlToMarkdown(html);
      expect(md).toContain("[Link text](https://example.com)");
    });

    it("converts images with alt text", () => {
      const html = '<img src="image.jpg" alt="Image description">';
      const md = htmlToMarkdown(html);
      expect(md).toContain("![Image description](image.jpg)");
    });

    it("converts images with title", () => {
      const html = '<img src="image.jpg" alt="Alt" title="Title">';
      const md = htmlToMarkdown(html);
      expect(md).toContain('![Alt](image.jpg "Title")');
    });

    it("converts unordered lists", () => {
      const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
      const md = htmlToMarkdown(html);
      // Turndown uses * for unordered lists by default
      expect(md).toContain("Item 1");
      expect(md).toContain("Item 2");
      expect(md).toMatch(/[*-]\s+Item 1/);
    });

    it("converts ordered lists", () => {
      const html = "<ol><li>First</li><li>Second</li></ol>";
      const md = htmlToMarkdown(html);
      // Turndown may add extra spacing
      expect(md).toMatch(/1\.\s+First/);
      expect(md).toMatch(/2\.\s+Second/);
    });

    it("converts blockquotes", () => {
      const html = "<blockquote>Quoted text</blockquote>";
      const md = htmlToMarkdown(html);
      expect(md).toContain("> Quoted text");
    });

    it("converts code blocks", () => {
      const html = "<pre><code>const x = 1;</code></pre>";
      const md = htmlToMarkdown(html);
      expect(md).toContain("```");
      expect(md).toContain("const x = 1;");
    });

    it("converts inline code", () => {
      const html = "<p>Use <code>npm install</code> command</p>";
      const md = htmlToMarkdown(html);
      expect(md).toContain("`npm install`");
    });

    it("removes style tags", () => {
      const html = "<style>.class { color: red; }</style><p>Content</p>";
      const md = htmlToMarkdown(html);
      expect(md).not.toContain(".class");
      expect(md).not.toContain("color:");
      expect(md.trim()).toBe("Content");
    });

    it("removes script tags", () => {
      const html = "<script>alert('xss');</script><p>Safe content</p>";
      const md = htmlToMarkdown(html);
      expect(md).not.toContain("alert");
      expect(md).not.toContain("script");
      expect(md.trim()).toBe("Safe content");
    });

    it("handles nested elements", () => {
      const html = "<p><strong><em>Bold and italic</em></strong></p>";
      const md = htmlToMarkdown(html);
      expect(md).toContain("***Bold and italic***");
    });

    it("converts tables (GFM)", () => {
      const html = `
        <table>
          <thead>
            <tr><th>Header 1</th><th>Header 2</th></tr>
          </thead>
          <tbody>
            <tr><td>Cell 1</td><td>Cell 2</td></tr>
          </tbody>
        </table>
      `;
      const md = htmlToMarkdown(html);
      expect(md).toContain("Header 1");
      expect(md).toContain("Header 2");
      expect(md).toContain("|");
    });

    it("handles empty input", () => {
      const md = htmlToMarkdown("");
      expect(md).toBe("");
    });

    it("handles whitespace-only input", () => {
      const md = htmlToMarkdown("   \n\t  ");
      expect(md.trim()).toBe("");
    });

    it("preserves line breaks appropriately", () => {
      const html = "<p>Line 1</p><p>Line 2</p>";
      const md = htmlToMarkdown(html);
      expect(md).toContain("Line 1");
      expect(md).toContain("Line 2");
      // Lines should be separated
      const lines = md.split("\n").filter((l) => l.trim());
      expect(lines.length).toBe(2);
    });

    it("handles special HTML entities", () => {
      const html = "<p>&amp; &lt; &gt; &quot;</p>";
      const md = htmlToMarkdown(html);
      expect(md).toContain("&");
      expect(md).toContain("<");
      expect(md).toContain(">");
    });

    it("handles full HTML document", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test</title></head>
          <body><p>Body content</p></body>
        </html>
      `;
      const md = htmlToMarkdown(html);
      expect(md.trim()).toBe("Body content");
    });
  });
});
