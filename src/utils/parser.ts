/**
 * Extracts article content from a webpage
 * Using Mozilla's Readability algorithm and DOMPurify for sanitization
 */
import { Readability } from "@mozilla/readability";
import DOMPurify from "dompurify";
import { franc } from "franc-min";
import { normalizeLanguageCode } from "./language";
import { highlightStorage } from "../services/highlightStorage";
import { highlightAnchor } from "../services/highlightAnchor";
import { StoredHighlight } from "../types/highlights";

import { createLogger } from "~/utils/logger";

// Create a logger for this module
const logger = createLogger("parser");

// --- Constants ---

// DOMPurify configuration (Whitelist approach)
const SANITIZE_CONFIG = {
  // Keep only semantic and structural tags necessary for reading content
  ALLOWED_TAGS: [
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "img",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "figure",
    "figcaption",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "strike",
    "sub",
    "sup",
    "br",
    "hr",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "span",
    "style",
  ],
  // Keep only essential attributes + those added by the hook
  ALLOWED_ATTR: [
    "href", // for <a>
    "src",
    "alt",
    "loading",
    "title", // for <img> (title is optional but common)
    "target",
    "rel", // for <a> (added by hook)
    "start", // for <ol>
    "colspan",
    "rowspan", // for <td>, <th>
    "scope", // for <th>
    "lang", // for language tagging
    "class", // for highlight classes
    "id", // for highlight styles
    "data-highlight-id", // highlight ID
    "data-highlight-color", // highlight color
    "data-note", // highlight notes
  ],
  // Explicitly disallow all data-* attributes
  ALLOW_DATA_ATTR: false,
};

// CSS styles for highlights to be injected into content
export const HIGHLIGHT_STYLES = `
  .readlite-highlight {
    display: inline !important;
    white-space: inherit !important;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
    border-radius: 2px;
    padding: 1px 0;
    margin: 0 -1px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    position: relative;
    text-decoration: none !important;
  }
  .readlite-highlight-beige { background-color: rgba(255,245,230,0.82) !important; }
  .readlite-highlight-cyan { background-color: rgba(181,228,255,0.82) !important; }
  .readlite-highlight-lavender { background-color: rgba(220,198,255,0.82) !important; }
  .readlite-highlight-olive { background-color: rgba(222,234,181,0.82) !important; }
  .readlite-highlight-peach { background-color: rgba(255,204,153,0.82) !important; }
`;

// --- Types ---

// Define the structure of the object returned by this parser
export interface Article {
  title: string;
  content: string; // Sanitized HTML content
  byline?: string; // Author metadata
  language?: string; // Detected language code (ISO 639-1)
}

// Interface for ReadabilityResult from Mozilla's Readability
interface ReadabilityResult {
  title: string;
  content: string;
  textContent: string;
  byline: string;
}

// --- Core Parsing Functions ---

/**
 * Detects the primary language of a text snippet.
 * @param text Text content to analyze.
 * @returns Normalized language code (ISO 639-1) or 'und' if detection fails.
 */
export const detectLanguage = (text: string): string => {
  if (!text) return "en";
  // Use a reasonable sample size for performance and accuracy
  const sampleText = text.slice(0, 1500);
  const detectedCode = franc(sampleText, { minLength: 3 });
  return normalizeLanguageCode(detectedCode);
};

/**
 * Extracts the main article content from a Document using Readability.
 */
export const parseArticle = async (doc: Document): Promise<Article | null> => {
  logger.info("Starting article parsing.");
  try {
    if (!doc || !doc.documentElement) {
      logger.error(
        "Invalid document object: Document or documentElement is null",
      );
      return null;
    }

    const documentClone = doc.cloneNode(true) as Document;
    if (!documentClone || !documentClone.documentElement) {
      logger.error("Failed to clone document");
      return null;
    }

    const url = doc.location?.href || "";

    // Extract content using Readability
    const readabilityResult = extractArticleContent(documentClone);
    if (!readabilityResult) {
      return null;
    }

    // Sanitize the HTML content
    const sanitizedContent = sanitizeHtml(readabilityResult.content);

    // Detect language from text content
    const language = detectLanguage(readabilityResult.textContent);
    logger.info(`Detected language: ${language}`);

    // Create the base article object
    const article: Article = {
      title: readabilityResult.title,
      content: sanitizedContent,
      byline: readabilityResult.byline,
      language: language,
    };

    // Render the article with highlights if needed
    return renderArticleWithHighlights(article, url);
  } catch (error) {
    logger.error("Error during article parsing pipeline:", error);
    return null;
  }
};

/**
 * Extracts article content using Mozilla's Readability.
 */
function extractArticleContent(doc: Document): ReadabilityResult | null {
  logger.info("Running Readability...");

  try {
    if (!doc || !doc.documentElement || !doc.body) {
      logger.error("Invalid document: Document is missing required elements");
      return null;
    }

    if (!doc.body.textContent || doc.body.textContent.trim().length === 0) {
      logger.error("Document body has no text content to parse");
      return null;
    }

    const safeDoc = ensureSafeDocument(doc);

    const reader = new Readability(safeDoc);
    const result = reader.parse();

    if (!result) {
      logger.warn("Readability failed to parse article content.");
      return null;
    }

    logger.info(`Readability extracted content titled: "${result.title}"`);
    return result as unknown as ReadabilityResult;
  } catch (error) {
    logger.error("Error extracting article content with Readability:", error);
    return null;
  }
}

/**
 * Ensures the document is safe for Readability to process.
 */
function ensureSafeDocument(doc: Document): Document {
  const safeDoc = doc.cloneNode(true) as Document;

  try {
    const scripts = safeDoc.querySelectorAll("script");
    scripts.forEach((script) => script.remove());

    if (!safeDoc.body) {
      const body = safeDoc.createElement("body");
      while (safeDoc.documentElement.childNodes.length > 0) {
        const child = safeDoc.documentElement.childNodes[0];
        if (child.nodeName !== "HEAD") {
          body.appendChild(child);
        } else {
          safeDoc.documentElement.removeChild(child);
        }
      }
      safeDoc.documentElement.appendChild(body);
    }

    if (
      safeDoc.body.querySelectorAll("p, div, section, article").length === 0
    ) {
      if (
        safeDoc.body.textContent &&
        safeDoc.body.textContent.trim().length > 0
      ) {
        const p = safeDoc.createElement("p");
        p.textContent = safeDoc.body.textContent;
        safeDoc.body.innerHTML = "";
        safeDoc.body.appendChild(p);
      }
    }

    const elementsToCheck = safeDoc.querySelectorAll(
      "article, section, div, header, footer, aside",
    );
    elementsToCheck.forEach((element) => {
      if (element.textContent && element.textContent.length > 100) {
        element.classList.add("readlite-content");
      }
    });

    return safeDoc;
  } catch (error) {
    logger.warn("Error preparing safe document, using original:", error);
    return doc;
  }
}

/**
 * Sanitizes HTML content using DOMPurify.
 */
function sanitizeHtml(html: string): string {
  logger.info("Sanitizing HTML content");
  setupDomPurifyHooks();
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

/**
 * Sets up DOMPurify hooks.
 */
function setupDomPurifyHooks(): void {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.getAttribute("href")?.startsWith("http")) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }

    if (node.tagName === "IMG") {
      node.setAttribute("loading", "lazy");
      if (!node.getAttribute("alt")) {
        node.setAttribute("alt", "Image");
      }
    }

    if (
      node.tagName === "SPAN" &&
      node.classList.contains("readlite-highlight")
    ) {
      const color = node.getAttribute("data-highlight-color");
      if (color) {
        node.classList.add(`readlite-highlight-${color}`);
        const note = node.getAttribute("data-note");
        if (note) {
          node.setAttribute("title", note);
        }
        const id = node.getAttribute("data-highlight-id");
        if (!id) {
          node.setAttribute(
            "data-highlight-id",
            `highlight-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          );
        }
      }
    }
  });
}

/**
 * Renders the article with highlights restored from storage.
 */
async function renderArticleWithHighlights(
  article: Article,
  url: string,
): Promise<Article> {
  logger.info("Rendering article with highlights for URL:", url);

  try {
    const tempDoc = document.implementation.createHTMLDocument();
    tempDoc.body.innerHTML = article.content;

    addHighlightStyles(tempDoc);
    markArticleContainer(tempDoc);
    await restoreHighlights(tempDoc, url);

    article.content = tempDoc.body.innerHTML;
    return article;
  } catch (error) {
    logger.error("Error rendering article with highlights:", error);
    return article;
  }
}

/**
 * Adds highlight styles to the document head.
 */
function addHighlightStyles(doc: Document): void {
  const styleTag = doc.createElement("style");
  styleTag.id = "readlite-highlight-styles";
  styleTag.textContent = HIGHLIGHT_STYLES;
  doc.head.appendChild(styleTag);
}

/**
 * Identifies and marks the main article container.
 */
function markArticleContainer(doc: Document): Element {
  const containerSelectors = [
    "article",
    "section",
    "div.article",
    "div.content",
    "div.article-content",
    "div.post-content",
    'div[role="main"]',
  ];

  for (const selector of containerSelectors) {
    const elements = doc.querySelectorAll(selector);
    if (elements.length > 0) {
      const container = elements[0] as Element;
      container.classList.add("readlite-article-container");
      return container;
    }
  }

  doc.body.classList.add("readlite-article-container");
  return doc.body;
}

/**
 * Restores highlights from storage and applies them to the document.
 */
async function restoreHighlights(doc: Document, url: string): Promise<void> {
  try {
    const highlights = await highlightStorage.getPageHighlights(url);
    for (const highlight of highlights) {
      await applyHighlight(doc, highlight);
    }
  } catch (error) {
    logger.error("Error restoring highlights:", error);
  }
}

/**
 * Applies a highlight to a document.
 */
async function applyHighlight(
  doc: Document,
  highlight: StoredHighlight,
): Promise<void> {
  try {
    if (highlight.text) {
      const selectorData = {
        exact: highlight.text,
        textBefore: highlight.textBefore || "",
        textAfter: highlight.textAfter || "",
        start: 0,
        end: highlight.text.length,
      };

      const success = highlightAnchor.applyHighlightWithSelector(
        doc.body,
        selectorData,
        highlight.id,
        `readlite-highlight readlite-highlight-${highlight.color}`,
      );

      if (success) return;
    }

    const matchingNodes = highlightAnchor.findAnchorNodes(doc, highlight);
    for (const textNode of matchingNodes) {
      const success = tryApplyHighlightToNode(doc, textNode, highlight);
      if (success) break;
    }
  } catch (error) {
    logger.error(`Failed to process highlight ${highlight.id}:`, error);
  }
}

/**
 * Attempts to apply a highlight to a specific text node.
 */
function tryApplyHighlightToNode(
  doc: Document,
  textNode: Node,
  highlight: StoredHighlight,
): boolean {
  try {
    const content = textNode.textContent || "";
    const normalizedContent = content.replace(/\s+/g, " ");
    const normalizedSearchText = highlight.text.replace(/\s+/g, " ").trim();

    const textIndex = normalizedContent.indexOf(normalizedSearchText);

    if (textIndex !== -1) {
      const range = doc.createRange();
      range.setStart(textNode, textIndex);
      const maxLength = Math.min(
        normalizedSearchText.length,
        content.length - textIndex,
      );
      range.setEnd(textNode, textIndex + maxLength);

      const highlightSpan = doc.createElement("span");
      highlightSpan.className = `readlite-highlight readlite-highlight-${highlight.color}`;
      highlightSpan.dataset.highlightId = highlight.id;
      highlightSpan.dataset.highlightColor = highlight.color;
      if (highlight.note) {
        highlightSpan.dataset.note = highlight.note;
        highlightSpan.title = highlight.note;
      }

      try {
        range.surroundContents(highlightSpan);
        return true;
      } catch (_e) {
        const fragment = range.extractContents();
        highlightSpan.appendChild(fragment);
        range.insertNode(highlightSpan);
        return true;
      }
    }
  } catch (error) {
    logger.error(`Error processing node for highlight ${highlight.id}:`, error);
  }
  return false;
}
