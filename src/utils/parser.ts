/**
 * Extracts article content from a webpage
 * Using Mozilla's Readability algorithm and DOMPurify for sanitization
 */
import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';
import { franc } from 'franc-min';
import { normalizeLanguageCode } from './language';
import { highlightStorage } from '../services/highlightStorage';
import { highlightAnchor } from '../services/highlightAnchor';
import { StoredHighlight } from '../types/highlights';

import { createLogger } from "~/utils/logger";

// Create a logger for this module
const logger = createLogger('parser');


// --- Constants ---

// DOMPurify configuration (Whitelist approach)
const SANITIZE_CONFIG = {
  // Keep only semantic and structural tags necessary for reading content
  ALLOWED_TAGS: [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
    'img', 'a', 
    'ul', 'ol', 'li', 
    'blockquote', 'pre', 'code', 
    'figure', 'figcaption', 
    'strong', 'em', 'b', 'i', 'u', 'strike', 'sub', 'sup', 
    'br', 'hr',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'span',
    'style'
  ],
  // Keep only essential attributes + those added by the hook
  ALLOWED_ATTR: [
    'href', // for <a>
    'src', 'alt', 'loading', 'title', // for <img> (title is optional but common)
    'target', 'rel', // for <a> (added by hook)
    'start', // for <ol>
    'colspan', 'rowspan', // for <td>, <th>
    'scope', // for <th>
    'lang',  // for language tagging
    'class', // for highlight classes
    'id',    // for highlight styles
    'data-highlight-id', // highlight ID
    'data-highlight-color', // highlight color
    'data-note' // highlight notes
  ],
  // Explicitly disallow all data-* attributes
  ALLOW_DATA_ATTR: false, 
  // FORBID_TAGS and FORBID_ATTR are removed as ALLOWED_* provide the whitelist
};

// CSS styles for highlights to be injected into content
const HIGHLIGHT_STYLES = `
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

// Selectors used by getArticleDate to find publication dates heuristically
const DATE_SELECTORS = [
  'time[datetime]', // Prefer <time> elements with datetime attribute
  'meta[property="article:published_time"]', // Common meta tag
  'meta[name="pubdate"]', 
  'meta[name="date"]',
  '[itemprop="datePublished"]', // Schema.org
  '.published', '.pubdate', '.date', '.time', '.timestamp', '.post-date' // Common class names
];

// --- Types ---

// Define the structure of the object returned by this parser
export interface Article {
  title: string;
  content: string;      // Sanitized HTML content
  textContent?: string; // Plain text content
  length?: number;     // Article length in characters
  excerpt?: string;    // Short excerpt/description
  byline?: string;     // Author metadata (often same as author)
  siteName?: string;
  dir?: string;        // Content direction (e.g., 'ltr')
  language?: string;   // Detected language code (ISO 639-1)
  date?: string;       // Formatted publication date (YYYY-MM-DD) if found
  // Note: We explicitly map byline to author in parseArticle if needed
}

// Interface for ReadabilityResult from Mozilla's Readability
interface ReadabilityResult {
  title: string;
  content: string;
  textContent: string;
  length: number;
  excerpt: string;
  byline: string;
  siteName: string;
  dir: string;
}

// Highlight structure from storage
interface Highlight {
  id: string;
  text: string;
  color: string;
  note?: string;
  textBefore?: string;
  textAfter?: string;
  url?: string;
  createdAt?: number;
  updatedAt?: number;
}

// --- Core Parsing Functions ---

/**
 * Detects the primary language of a text snippet.
 * @param text Text content to analyze.
 * @returns Normalized language code (ISO 639-1) or 'und' if detection fails.
 */
export const detectLanguage = (text: string): string => {
  if (!text) return 'en';
  // Use a reasonable sample size for performance and accuracy
  const sampleText = text.slice(0, 1500);
  const detectedCode = franc(sampleText, { minLength: 3 }); // Use franc options if needed
  // Normalize the detected code (e.g., 'eng' -> 'en')
  return normalizeLanguageCode(detectedCode);
};

/**
 * Extracts the main article content from a Document using Readability.
 * This function handles just the extraction without any rendering or highlight restoration.
 * @param doc The original Document object.
 * @returns A Promise resolving to the processed Article object or null if parsing fails.
 */
export const parseArticle = async (doc: Document): Promise<Article | null> => {
  logger.info("Starting article parsing.");
  try {
    if (!doc || !doc.documentElement) {
      logger.error("Invalid document object: Document or documentElement is null");
      return null;
    }
    
    const documentClone = doc.cloneNode(true) as Document;
    if (!documentClone || !documentClone.documentElement) {
      logger.error("Failed to clone document");
      return null;
    }
    
    const url = doc.location?.href || '';
    
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
    
    // Find publication date
    const publicationDate = getArticleDate(documentClone);
    logger.info(`Found date: ${publicationDate || 'None'}`);
    
    // Create the base article object
    const article: Article = {
      title: readabilityResult.title,
      content: sanitizedContent,
      textContent: readabilityResult.textContent,
      length: readabilityResult.length,
      excerpt: readabilityResult.excerpt,
      byline: readabilityResult.byline,
      siteName: readabilityResult.siteName,
      dir: readabilityResult.dir,
      language: language,
      date: publicationDate,
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
 * @param doc The document to extract content from.
 * @returns The Readability extraction result or null if extraction fails.
 */
function extractArticleContent(doc: Document): ReadabilityResult | null {
  logger.info("Running Readability...");
  
  try {
    // Check for valid document structure
    if (!doc || !doc.documentElement || !doc.body) {
      logger.error("Invalid document: Document is missing required elements");
      return null;
    }
    
    // Make sure there's content to parse
    if (!doc.body.textContent || doc.body.textContent.trim().length === 0) {
      logger.error("Document body has no text content to parse");
      return null;
    }
    
    // Verify that essential DOM methods/properties are available
    if (typeof doc.createElement !== 'function' || typeof doc.querySelectorAll !== 'function') {
      logger.error("Document is missing essential DOM methods");
      return null;
    }
    
    // Create a safe wrapper to protect against specific Readability bugs
    const safeDoc = ensureSafeDocument(doc);
    
    const reader = new Readability(safeDoc);
    const result = reader.parse();
    
    if (!result) {
      logger.warn("Readability failed to parse article content.");
      return null;
    }
    
    logger.info(`Readability extracted content titled: "${result.title}"`);
    // Cast the result to our ReadabilityResult interface
    // This is safe because we've checked for null
    return result as ReadabilityResult;
  } catch (error) {
    logger.error("Error extracting article content with Readability:", error);
    return null;
  }
}

/**
 * Ensures the document is safe for Readability to process by fixing common issues
 * that could lead to null property access errors.
 * 
 * @param doc The original document
 * @returns A safer document for Readability processing
 */
function ensureSafeDocument(doc: Document): Document {
  // Create a clone to work with
  const safeDoc = doc.cloneNode(true) as Document;
  
  try {
    // Remove any scripts that might interfere with parsing
    const scripts = safeDoc.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    // Ensure HTML has body
    if (!safeDoc.body) {
      const body = safeDoc.createElement('body');
      
      // Move all content from documentElement to body if needed
      while (safeDoc.documentElement.childNodes.length > 0) {
        const child = safeDoc.documentElement.childNodes[0];
        if (child.nodeName !== 'HEAD') {
          body.appendChild(child);
        } else {
          safeDoc.documentElement.removeChild(child);
        }
      }
      
      safeDoc.documentElement.appendChild(body);
    }
    
    // Ensure there's at least one paragraph element to avoid
    // the "Cannot read properties of null (reading 'tagName')" error
    if (safeDoc.body.querySelectorAll('p, div, section, article').length === 0) {
      // If there's no structured content but there is text, wrap it in a paragraph
      if (safeDoc.body.textContent && safeDoc.body.textContent.trim().length > 0) {
        const p = safeDoc.createElement('p');
        p.textContent = safeDoc.body.textContent;
        safeDoc.body.innerHTML = '';
        safeDoc.body.appendChild(p);
      }
    }
    
    // Check for and fix any elements Readability might try to access that could be null
    const elementsToCheck = safeDoc.querySelectorAll('article, section, div, header, footer, aside');
    elementsToCheck.forEach(element => {
      // Add safety classes and roles to help Readability identify content
      if (element.textContent && element.textContent.length > 100) {
        element.classList.add('readlite-content');
      }
    });
    
    return safeDoc;
  } catch (error) {
    logger.warn("Error preparing safe document, using original:", error);
    return doc;
  }
}

/**
 * Sanitizes HTML content using DOMPurify with custom configuration.
 * @param html The HTML content to sanitize.
 * @returns Sanitized HTML string.
 */
function sanitizeHtml(html: string): string {
  logger.info("Sanitizing HTML content");
  
  // Set up DOMPurify hook for additional processing
  setupDomPurifyHooks();
  
  // Sanitize the HTML content
  const sanitizedContent = DOMPurify.sanitize(html, SANITIZE_CONFIG);
  
  // Log a sample of the sanitized content
  logger.info(`HTML content AFTER sanitization (first 500 chars):`, 
    sanitizedContent.substring(0, 500));
  
  return sanitizedContent;
}

/**
 * Sets up DOMPurify hooks for handling links, images, and highlight spans.
 */
function setupDomPurifyHooks(): void {
  // This hook runs after the main sanitization to process allowed attributes
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    // Add target="_blank" and rel="noopener noreferrer" to external links
    if (node.tagName === 'A' && node.getAttribute('href')?.startsWith('http')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
    
    // Add lazy loading and default alt text to images
    if (node.tagName === 'IMG') {
      node.setAttribute('loading', 'lazy');
      if (!node.getAttribute('alt')) {
        node.setAttribute('alt', 'Image');
      }
    }
    
    // Special handling for highlight spans
    if (node.tagName === 'SPAN' && node.classList.contains('readlite-highlight')) {
      const color = node.getAttribute('data-highlight-color');
      if (color) {
        // Make sure the color-specific class is applied
        node.classList.add(`readlite-highlight-${color}`);
        
        // Add title attribute for any notes
        const note = node.getAttribute('data-note');
        if (note) {
          node.setAttribute('title', note);
        }
        
        // Ensure ID attribute is preserved
        const id = node.getAttribute('data-highlight-id');
        if (!id) {
          // Generate a new ID if missing
          node.setAttribute('data-highlight-id', 
            `highlight-${Date.now()}-${Math.floor(Math.random() * 10000)}`);
        }
      }
    }
  });
}

// --- Rendering & Highlight Functions ---

/**
 * Renders the article with highlights restored from storage.
 * @param article The parsed article object.
 * @param url The URL of the article (for retrieving highlights).
 * @returns The article with highlights applied.
 */
async function renderArticleWithHighlights(article: Article, url: string): Promise<Article> {
  logger.info("Rendering article with highlights for URL:", url);
  
  try {
    // Create a temporary document to work with the sanitized content
    const tempDoc = document.implementation.createHTMLDocument();
    tempDoc.body.innerHTML = article.content;
    
    // Add highlight styles to the document head
    addHighlightStyles(tempDoc);
    
    // Identify the main article container for more consistent DOM paths
    markArticleContainer(tempDoc);
    
    // Restore highlights from storage
    await restoreHighlights(tempDoc, url);
    
    // Get the final content with highlights applied
    article.content = tempDoc.documentElement.outerHTML;
    
    return article;
  } catch (error) {
    logger.error("Error rendering article with highlights:", error);
    return article; // Return the original article if rendering fails
  }
}

/**
 * Adds highlight styles to the document head.
 * @param doc The document to add styles to.
 */
function addHighlightStyles(doc: Document): void {
  const styleTag = doc.createElement('style');
  styleTag.id = 'readlite-highlight-styles';
  styleTag.textContent = HIGHLIGHT_STYLES;
  doc.head.appendChild(styleTag);
}

/**
 * Identifies and marks the main article container for consistent DOM paths.
 * @param doc The document to process.
 * @returns The identified article container.
 */
function markArticleContainer(doc: Document): Element {
  // Look for common article container elements
  const containerSelectors = [
    'article', 
    'section', 
    'div.article', 
    'div.content', 
    'div.article-content', 
    'div.post-content', 
    'div[role="main"]'
  ];
  
  for (const selector of containerSelectors) {
    const elements = doc.querySelectorAll(selector);
    if (elements.length > 0) {
      const container = elements[0] as Element;
      logger.info(`Found article container: ${container.tagName} with ${container.childNodes.length} child nodes`);
      
      // Add a class to the article container for easier identification
      container.classList.add('readlite-article-container');
      return container;
    }
  }
  
  // If no specific container found, use the body as a fallback
  logger.info(`No specific article container found, using body`);
  doc.body.classList.add('readlite-article-container');
  return doc.body;
}

/**
 * Restores highlights from storage and applies them to the document.
 * @param doc The document to apply highlights to.
 * @param url The URL of the article.
 */
async function restoreHighlights(doc: Document, url: string): Promise<void> {
  try {
    // Get highlights for this URL
    const highlights = await highlightStorage.getPageHighlights(url);
    logger.info(`Found ${highlights.length} highlights to restore`);
    
    // Debug: get all text nodes in document for comparison
    const allTextNodes = getAllTextNodes(doc.body);
    logger.info(`Total text nodes in document: ${allTextNodes.length}`);
    
    // Log sample of document content for debugging
    logDocumentTextSample(allTextNodes);
    
    // Process each highlight
    for (const highlight of highlights) {
      await applyHighlight(doc, highlight);
    }
  } catch (error) {
    logger.error("Error restoring highlights:", error);
  }
}

/**
 * Gets all text nodes in a document node.
 * @param node The node to get text nodes from.
 * @returns Array of text nodes.
 */
function getAllTextNodes(node: Node): Node[] {
  const textNodes: Node[] = [];
  const walker = document.createTreeWalker(
    node, 
    NodeFilter.SHOW_TEXT, 
    { 
      acceptNode: node => 
        node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT 
    }
  );
  
  let current = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }
  
  return textNodes;
}

/**
 * Logs a sample of document text for debugging purposes.
 * @param textNodes Array of text nodes to sample from.
 */
function logDocumentTextSample(textNodes: Node[]): void {
  logger.info("DOCUMENT TEXT SAMPLE:");
  let fullDocText = '';
  textNodes.slice(0, 10).forEach((node, i) => {
    const content = node.textContent || '';
    fullDocText += content + ' ';
    logger.info(`Node ${i}: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
  });
}

/**
 * Applies a highlight to a document.
 * @param doc The document to apply the highlight to.
 * @param highlight The highlight to apply.
 */
async function applyHighlight(doc: Document, highlight: StoredHighlight): Promise<void> {
  try {
    // Log highlight details for debugging
    logHighlightDetails(highlight);
    
    // Try selector-based approach first (more robust for complex highlights)
    if (highlight.text) {
      const selectorSuccess = applySelectorBasedHighlight(doc, highlight);
      if (selectorSuccess) {
        return; // Successfully applied highlight
      }
    }
    
    // Fall back to node-based approach
    await applyNodeBasedHighlight(doc, highlight);
    
  } catch (error) {
    logger.error(`Failed to process highlight ${highlight.id}:`, error);
  }
}

/**
 * Logs detailed information about a highlight for debugging.
 * @param highlight The highlight to log details for.
 */
function logHighlightDetails(highlight: StoredHighlight): void {
  logger.info(`-------- HIGHLIGHT DEBUG --------`);
  logger.info(`Highlight ID: ${highlight.id}`);
  logger.info(`Original text: "${highlight.text}"`);
  
  // Log normalized text
  const normalizedHighlightText = highlight.text.replace(/\s+/g, ' ').trim();
  logger.info(`Normalized highlight text: "${normalizedHighlightText}"`);
  
  // Log contextual information
  if (highlight.textBefore) {
    logger.info(`Text before: "${highlight.textBefore}"`);
  }
  if (highlight.textAfter) {
    logger.info(`Text after: "${highlight.textAfter}"`);
  }
  
  logger.info(`Attempting to restore highlight: ${highlight.id} - "${highlight.text.substring(0, 30)}..."`);
}

/**
 * Applies a highlight using selector-based approach.
 * @param doc The document to apply the highlight to.
 * @param highlight The highlight to apply.
 * @returns Whether the highlight was successfully applied.
 */
function applySelectorBasedHighlight(doc: Document, highlight: StoredHighlight): boolean {
  // Create selector data for the highlight
  const selectorData = {
    exact: highlight.text,
    textBefore: highlight.textBefore || '',
    textAfter: highlight.textAfter || '',
    start: 0,
    end: highlight.text.length
  };
  
  // Try applying highlight using the advanced selector-based approach
  const success = highlightAnchor.applyHighlightWithSelector(
    doc.body,
    selectorData,
    highlight.id,
    `readlite-highlight readlite-highlight-${highlight.color}`
  );
  
  if (success) {
    logger.info(`Successfully restored complex highlight ${highlight.id} using selector approach`);
    return true;
  } else {
    logger.info(`Selector-based approach failed, trying node-based approach`);
    return false;
  }
}

/**
 * Applies a highlight using node-based approach as a fallback.
 * @param doc The document to apply the highlight to.
 * @param highlight The highlight to apply.
 */
async function applyNodeBasedHighlight(doc: Document, highlight: StoredHighlight): Promise<void> {
  const matchingNodes = highlightAnchor.findAnchorNodes(doc, highlight);
  
  if (matchingNodes.length === 0) {
    logger.warn(`No matching nodes found for highlight ${highlight.id}: "${highlight.text.substring(0, 20)}..."`);
    return;
  }
  
  logger.info(`Found ${matchingNodes.length} potential nodes for highlight ${highlight.id}`);
  
  // Try to apply highlight to each potential match
  for (const textNode of matchingNodes) {
    const success = tryApplyHighlightToNode(doc, textNode, highlight);
    if (success) break; // Move to next highlight if successful
  }
}

/**
 * Attempts to apply a highlight to a specific text node.
 * @param doc The document containing the node.
 * @param textNode The text node to highlight.
 * @param highlight The highlight data.
 * @returns Whether the highlight was successfully applied.
 */
function tryApplyHighlightToNode(doc: Document, textNode: Node, highlight: StoredHighlight): boolean {
  try {
    const content = textNode.textContent || '';
    
    // Log the content we're searching in
    logger.info(`Searching in text node content: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
    logger.info(`Looking for: "${highlight.text.substring(0, 50)}${highlight.text.length > 50 ? '...' : ''}"`);
    
    // Normalize both the content and the search text
    const normalizedContent = content.replace(/\s+/g, ' ');
    const normalizedSearchText = highlight.text.replace(/\s+/g, ' ').trim();
    
    // Find the text index
    let textIndex = findTextPosition(normalizedContent, normalizedSearchText);
    
    if (textIndex !== -1) {
      return createAndApplyHighlight(doc, textNode, textIndex, normalizedSearchText, highlight);
    }
  } catch (error) {
    logger.error(`Error processing node for highlight ${highlight.id}:`, error);
  }
  
  return false;
}

/**
 * Finds the position of highlight text in content with various fallback strategies.
 * @param content The normalized content to search in.
 * @param searchText The normalized text to search for.
 * @returns The index of the text if found, -1 otherwise.
 */
function findTextPosition(content: string, searchText: string): number {
  // Try exact match first
  let textIndex = content.indexOf(searchText);
  
  // If exact match not found, try various fallback approaches
  if (textIndex === -1 && searchText.length > 10) {
    logger.info(`Exact match not found, trying partial matches`);
    
    // Try with first part of the text
    const firstPart = searchText.substring(0, 10);
    textIndex = content.indexOf(firstPart);
    
    if (textIndex !== -1) {
      logger.info(`Found partial match starting with: "${firstPart}"`);
      return textIndex;
    }
    
    // Try with middle part of the text
    const middleStart = Math.max(0, Math.floor(searchText.length / 2) - 5);
    const middlePart = searchText.substring(middleStart, middleStart + 10);
    textIndex = content.indexOf(middlePart);
    
    if (textIndex !== -1) {
      logger.info(`Found match with middle part: "${middlePart}"`);
      // Adjust textIndex to approximate the start of the full text
      return Math.max(0, textIndex - middleStart);
    }
    
    // Try with character chunks (useful for CJK text)
    for (let i = 0; i < Math.min(searchText.length, 20); i += 3) {
      const chunk = searchText.substring(i, i + 6);
      if (chunk.length < 3) continue;
      
      textIndex = content.indexOf(chunk);
      if (textIndex !== -1) {
        logger.info(`Found match with chunk: "${chunk}"`);
        // Adjust textIndex to approximate the start
        return Math.max(0, textIndex - i);
      }
    }
  }
  
  return textIndex;
}

/**
 * Creates and applies a highlight to a text node.
 * @param doc The document containing the node.
 * @param textNode The text node to highlight.
 * @param textIndex The starting index for the highlight.
 * @param searchText The text to highlight.
 * @param highlight The highlight data.
 * @returns Whether the highlight was successfully applied.
 */
function createAndApplyHighlight(
  doc: Document, 
  textNode: Node, 
  textIndex: number, 
  searchText: string, 
  highlight: StoredHighlight
): boolean {
  try {
    const content = textNode.textContent || '';
    
    // Create a range for the target text
    const range = doc.createRange();
    
    // Set start position
    range.setStart(textNode, textIndex);
    
    // For end position, limit to a reasonable length
    const maxLength = Math.min(searchText.length, content.length - textIndex);
    range.setEnd(textNode, textIndex + maxLength);
    
    logger.info(`Created range from index ${textIndex} to ${textIndex + maxLength}`);
    logger.info(`Range text: "${range.toString()}"`);
    
    // Only proceed if the range contains meaningful text
    const rangeText = range.toString();
    if (rangeText.length < 3 || rangeText.length < searchText.length * 0.3) {
      // Try to improve the range if it's too short
      const improvedRange = improveTextRange(doc, textNode, textIndex, content, searchText);
      if (!improvedRange) {
        return false;
      }
      // Use the improved range
      range.setStart(improvedRange.startContainer, improvedRange.startOffset);
      range.setEnd(improvedRange.endContainer, improvedRange.endOffset);
    }
    
    // Create a highlight span
    const highlightSpan = createHighlightSpan(doc, highlight);
    
    // Apply the highlight
    try {
      range.surroundContents(highlightSpan);
      logger.info(`Applied highlight ${highlight.id} to text "${highlight.text.substring(0, 20)}..."`);
      return true;
    } catch (e) {
      // Try alternate approach if surroundContents fails
      return applyAlternateHighlightMethod(doc, range, highlightSpan, highlight);
    }
  } catch (e) {
    logger.warn(`Range error for highlight ${highlight.id}:`, e);
    return false;
  }
}

/**
 * Attempts to improve a text range that's too short or inaccurate.
 * @param doc The document.
 * @param textNode The text node.
 * @param textIndex The starting index.
 * @param content The node content.
 * @param searchText The text to search for.
 * @returns An improved Range or null if improvement failed.
 */
function improveTextRange(
  doc: Document, 
  textNode: Node, 
  textIndex: number, 
  content: string, 
  searchText: string
): Range | null {
  try {
    logger.warn(`Range text too short or different from target`);
    
    // Try a different approach - create a new range with approximate positions
    // Expand the range to get more context
    const expandedStart = Math.max(0, textIndex - 10);
    const expandedEnd = Math.min(content.length, textIndex + searchText.length + 10);
    
    // Create expanded range for context
    const expandedRange = doc.createRange();
    expandedRange.setStart(textNode, expandedStart);
    expandedRange.setEnd(textNode, expandedEnd);
    
    const expandedText = expandedRange.toString();
    logger.info(`Expanded text for context: "${expandedText}"`);
    
    // Find the best match within this expanded text
    let bestMatchStart = 0;
    let bestMatchLength = 0;
    
    for (let i = 0; i < 10; i++) {
      const testPortion = searchText.substring(i * 5, i * 5 + 20);
      if (testPortion.length < 3) continue;
      
      const portionIndex = expandedText.indexOf(testPortion);
      if (portionIndex !== -1) {
        // Found a match in the expanded context
        bestMatchStart = expandedStart + portionIndex;
        bestMatchLength = Math.min(searchText.length, content.length - bestMatchStart);
        logger.info(`Found better match at position ${bestMatchStart} using portion "${testPortion}"`);
        
        // Create an improved range
        const improvedRange = doc.createRange();
        improvedRange.setStart(textNode, bestMatchStart);
        improvedRange.setEnd(textNode, bestMatchStart + bestMatchLength);
        return improvedRange;
      }
    }
  } catch (e) {
    logger.warn(`Range adjustment failed:`, e);
  }
  
  return null;
}

/**
 * Creates a highlight span element with the appropriate attributes.
 * @param doc The document to create the span in.
 * @param highlight The highlight data.
 * @returns The created highlight span element.
 */
function createHighlightSpan(doc: Document, highlight: StoredHighlight): HTMLSpanElement {
  const highlightSpan = doc.createElement('span');
  highlightSpan.className = `readlite-highlight readlite-highlight-${highlight.color}`;
  highlightSpan.dataset.highlightId = highlight.id;
  highlightSpan.dataset.highlightColor = highlight.color;
  
  if (highlight.note) {
    highlightSpan.dataset.note = highlight.note;
    highlightSpan.title = highlight.note;
  }
  
  return highlightSpan;
}

/**
 * Applies an alternate highlighting method if the primary method fails.
 * @param doc The document.
 * @param range The range to highlight.
 * @param highlightSpan The highlight span element.
 * @param highlight The highlight data.
 * @returns Whether the highlight was successfully applied.
 */
function applyAlternateHighlightMethod(
  doc: Document,
  range: Range,
  highlightSpan: HTMLSpanElement,
  highlight: StoredHighlight
): boolean {
  logger.warn(`Failed to apply highlight ${highlight.id} with surroundContents, trying alternate method`);
  
  try {
    // Extract and insert approach
    const fragment = range.extractContents();
    highlightSpan.appendChild(fragment);
    range.insertNode(highlightSpan);
    logger.info(`Applied highlight ${highlight.id} using alternate method`);
    return true;
  } catch (e2) {
    logger.warn(`Alternative highlighting method also failed for ${highlight.id}:`, e2);
    
    // Last resort - insert an empty highlight span with reconstructed text
    try {
      // Reset to start position
      range.collapse(true);
      
      // Create a text node with the original text
      const textContent = doc.createTextNode(highlight.text);
      highlightSpan.appendChild(textContent);
      
      // Insert at position
      range.insertNode(highlightSpan);
      logger.info(`Inserted highlight with reconstructed text as fallback`);
      return true;
    } catch (e3) {
      logger.warn(`All highlighting approaches failed for ${highlight.id}`);
      return false;
    }
  }
}

/**
 * Attempts to extract and format the publication date from a document.
 * Uses various heuristics (time tags, meta tags, common selectors).
 * @param doc The Document to search within.
 * @returns Formatted date string (YYYY-MM-DD) or undefined if not found/parsable.
 */
function getArticleDate(doc: Document): string | undefined {
  for (const selector of DATE_SELECTORS) {
    const element = doc.querySelector(selector);
    let dateString: string | null = null;

    if (element) {
      if (element.tagName === 'META') {
        dateString = element.getAttribute('content');
      } else if (element.tagName === 'TIME') {
        dateString = element.getAttribute('datetime');
      } 
      // If still no dateString, try textContent for other selectors
      if (!dateString) {
          dateString = element.textContent;
      }
    }

    if (dateString) {
      try {
        const date = new Date(dateString.trim());
        // Check if the parsed date is valid before formatting
        if (!isNaN(date.getTime())) {
          return formatDate(date); // Format valid dates
        }
      } catch (e) {
        // Ignore parsing errors for this selector and try the next
        logger.warn(`Could not parse date string "${dateString}" from selector "${selector}"`);
      }
    }
  }
  
  return undefined; // No valid date found
}

/**
 * Formats a Date object into a standard YYYY-MM-DD string.
 * Returns an empty string if the date is invalid.
 */
function formatDate(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    logger.warn(`formatDate received an invalid date object.`);
    return ''; // Return empty string for invalid dates
  }
  
  try {
    // Use toISOString for a guaranteed locale-independent YYYY-MM-DD format
    return date.toISOString().split('T')[0];
  } catch (error) {
    logger.error(`Error formatting date object:`, error);
    // Fallback to a simple format if toISOString fails unexpectedly
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
} 