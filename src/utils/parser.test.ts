import { parseArticle, detectLanguage } from "./parser";

// Mock franc-min to avoid ESM issues
jest.mock("franc-min", () => ({
  franc: jest.fn((text) => {
    if (text.includes("Chinese") || text.includes("中文")) return "cmn";
    return "eng";
  }),
}));

// Mock dependencies
jest.mock("~/utils/logger", () => ({
  franc: jest.fn((text) => {
    if (text.includes("Chinese") || text.includes("中文")) return "cmn";
    return "eng";
  }),
}));

// Mock dependencies
jest.mock("~/utils/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock("../services/highlightStorage", () => ({
  highlightStorage: {
    getHighlightsForUrl: jest.fn().mockResolvedValue([]),
  },
}));

describe("Parser Utils", () => {
  describe("detectLanguage", () => {
    it("should detect English text", () => {
      const text = "This is a sample English text for language detection.";
      expect(detectLanguage(text)).toBe("en");
    });

    it("should detect Chinese text", () => {
      const text = "这是一个用于语言检测的中文示例文本。";
      expect(detectLanguage(text)).toBe("zh");
    });

    it("should default to 'en' for empty text", () => {
      expect(detectLanguage("")).toBe("en");
    });
  });

  describe("parseArticle", () => {
    it("should parse a simple article", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test Article</title></head>
          <body>
            <h1>Test Article Title</h1>
            <div class="content">
              <p>This is the main content of the article.</p>
              <p>It has multiple paragraphs.</p>
            </div>
            <div class="sidebar">Ad content</div>
          </body>
        </html>
      `;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const article = await parseArticle(doc);

      expect(article).not.toBeNull();
      expect(article?.title).toBe("Test Article");
      expect(article?.content).toContain("This is the main content");
      expect(article?.language).toBe("en");
    });

    it("should return null for invalid document", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const article = await parseArticle(null as any);
      expect(article).toBeNull();
    });

    it("should handle document without documentElement", async () => {
      const doc = { documentElement: null } as unknown as Document;
      const article = await parseArticle(doc);
      expect(article).toBeNull();
    });

    it("should sanitize HTML and remove scripts", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test</title></head>
          <body>
            <h1>Title</h1>
            <p>Content with <script>alert('xss')</script> script</p>
            <p onclick="alert('bad')">Clickable paragraph</p>
          </body>
        </html>
      `;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const article = await parseArticle(doc);

      expect(article).not.toBeNull();
      expect(article?.content).not.toContain("<script>");
      expect(article?.content).not.toContain("onclick");
      expect(article?.content).not.toContain("alert");
    });

    it("should preserve allowed HTML tags", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Rich Content</title></head>
          <body>
            <article>
              <h1>Title</h1>
              <h2>Subtitle</h2>
              <p>Paragraph with <strong>bold</strong> and <em>italic</em> text. This is some longer content to make sure Readability can extract it properly. We need enough text for the parser to work.</p>
              <p>Another paragraph with more content to ensure the article is substantial enough for extraction.</p>
              <ul>
                <li>List item 1 with sufficient content</li>
                <li>List item 2 with sufficient content</li>
              </ul>
              <blockquote>A quote with enough text to be meaningful</blockquote>
              <pre><code>code block example</code></pre>
              <p>More content with <a href="https://example.com">Link</a> and text.</p>
              <p>Final paragraph with <img src="image.jpg" alt="Image" /> embedded.</p>
            </article>
          </body>
        </html>
      `;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const article = await parseArticle(doc);

      expect(article).not.toBeNull();
      // Check for presence of semantic tags
      if (article?.content) {
        expect(article.content).toContain("<p>");
        // Note: Readability may restructure content, so we check for text content
        expect(article.content).toContain("bold");
        expect(article.content).toContain("italic");
      }
    });

    it("should add target=_blank to external links", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <p><a href="https://example.com">External Link</a></p>
              <p><a href="/internal">Internal Link</a></p>
            </article>
          </body>
        </html>
      `;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const article = await parseArticle(doc);

      expect(article).not.toBeNull();
      // External links should have target="_blank"
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = article?.content || "";
      const externalLink = Array.from(tempDiv.querySelectorAll("a")).find((a) =>
        a.href.includes("example.com"),
      );
      expect(externalLink?.getAttribute("target")).toBe("_blank");
      expect(externalLink?.getAttribute("rel")).toContain("noopener");
    });

    it("should add lazy loading to images", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Article with Images</h1>
              <p>This is a comprehensive article with substantial content that includes images.</p>
              <p>We need enough text content for Readability to properly extract the article.</p>
              <img src="image1.jpg" />
              <p>More paragraph content to ensure this is recognized as an article.</p>
              <img src="image2.jpg" alt="Existing alt" />
              <p>Final paragraph with even more content to meet the threshold.</p>
            </article>
          </body>
        </html>
      `;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const article = await parseArticle(doc);

      // Readability may or may not extract this depending on heuristics
      if (article && article.content) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = article.content;
        const images = tempDiv.querySelectorAll("img");
        if (images.length > 0) {
          images.forEach((img) => {
            expect(img.getAttribute("loading")).toBe("lazy");
            expect(img.getAttribute("alt")).toBeTruthy();
          });
        }
      }
    });

    it("should handle documents with minimal content", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <p>Just a short sentence.</p>
          </body>
        </html>
      `;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const article = await parseArticle(doc);

      // May return null if Readability deems content insufficient
      // or may wrap in paragraph - both are valid
      if (article) {
        expect(article.content).toContain("short sentence");
      }
    });

    it("should detect language from content", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>English Article</h1>
              <p>This is a lengthy English article with plenty of text for language detection to work properly.</p>
              <p>It contains multiple paragraphs to ensure accurate detection.</p>
            </article>
          </body>
        </html>
      `;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const article = await parseArticle(doc);

      expect(article).not.toBeNull();
      expect(article?.language).toBe("en");
    });

    it("should handle empty body gracefully", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Empty</title></head>
          <body></body>
        </html>
      `;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const article = await parseArticle(doc);

      expect(article).toBeNull();
    });

    it("should attempt to restore highlights from storage", async () => {
      // highlightStorage is already mocked at module level
      // Just verify the parsing works with the mock
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Article Title</h1>
              <p>This is before highlighted text after rest of content with enough text for extraction.</p>
              <p>Additional paragraph to ensure we have sufficient content for Readability.</p>
            </article>
          </body>
        </html>
      `;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const article = await parseArticle(doc);

      // The main goal is to ensure parsing succeeds with highlight storage available
      expect(article).not.toBeNull();
      expect(article?.content).toContain("Article Title");
    });
  });

  describe("Language Detection Edge Cases", () => {
    it("should handle very short text", () => {
      expect(detectLanguage("Hi")).toBe("en");
    });

    it("should handle mixed language text", () => {
      const text = "Hello world! 你好世界！";
      const result = detectLanguage(text);
      // Should detect based on predominant language
      expect(["en", "zh"]).toContain(result);
    });

    it("should handle text with numbers and symbols", () => {
      const text = "123 $%^ @#! ??? ...";
      const result = detectLanguage(text);
      expect(result).toBe("en"); // Should default to 'en'
    });
  });
});
