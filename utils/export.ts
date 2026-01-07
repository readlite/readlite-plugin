import TurndownService from "turndown";
import * as turndownPluginGfm from "turndown-plugin-gfm";

import { createLogger } from "@/utils/logger";

// Create a logger for this module
const logger = createLogger("utils");

/**
 * Export utilities for article content
 * Support for exporting to Markdown
 */

/**
 * Standardize filename by removing special characters and ensuring it's not too long
 * @param title - Article title
 * @param extension - File extension (without dot)
 * @returns Standardized filename
 */
export const generateFilename = (title: string, extension: string): string => {
  // Trim white space and remove special characters that could cause issues
  let filename = title
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-") // Replace Windows/Unix invalid filename chars
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/_+/g, "_") // Replace multiple underscores with one
    .replace(/[^\w\s\.\-]/g, ""); // Remove non-alphanumeric chars except dots, spaces, hyphens

  // Truncate to reasonable length
  if (filename.length > 100) {
    filename = filename.substring(0, 100);
  }

  // Make sure there's at least a default filename
  if (!filename) {
    filename = "article";
  }

  // Add timestamp to ensure uniqueness
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);

  return `${filename}_${timestamp}.${extension}`;
};

/**
 * Convert HTML to Markdown
 * @param html - HTML content to convert
 * @returns Markdown string
 */
export const htmlToMarkdown = (html: string): string => {
  // Create a temporary DOM to clean up the HTML
  let cleanHtml = html;

  if (typeof document !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Remove style and script tags which shouldn't be in Markdown
      const styles = doc.querySelectorAll("style");
      styles.forEach((s) => s.remove());

      const scripts = doc.querySelectorAll("script");
      scripts.forEach((s) => s.remove());

      // If we have a body, use its content (handles full HTML docs)
      if (doc.body) {
        cleanHtml = doc.body.innerHTML;
      }
    } catch (e) {
      logger.error("Error cleaning HTML for Markdown conversion:", e);
      // Fallback to original HTML if parsing fails
    }
  }

  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });

  // Add GitHub Flavored Markdown support
  turndownService.use(turndownPluginGfm.gfm);

  // Configure turndown to handle some HTML elements better
  turndownService.addRule("imageWithAttributes", {
    // Only match <img> elements that have either alt or title attributes
    filter: (node: Node): boolean => {
      if (node.nodeName !== "IMG") {
        return false;
      }
      const imgNode = node as HTMLImageElement;
      return !!imgNode.getAttribute("alt") || !!imgNode.getAttribute("title");
    },
    replacement: (content: string, node: Node): string => {
      const imgNode = node as HTMLImageElement;
      const alt = imgNode.getAttribute("alt") || "";
      const title = imgNode.getAttribute("title")
        ? ` "${imgNode.getAttribute("title")}"`
        : "";
      return `![${alt}](${imgNode.getAttribute("src")}${title})`;
    },
  });

  return turndownService.turndown(html);
};

/**
 * Simple download function that uses the most appropriate method for Chrome extensions
 * @param content - Content to download
 * @param filename - Filename
 * @param mimeType - MIME type
 */
function downloadFile(
  content: string | Blob,
  filename: string,
  mimeType: string,
): void {
  // Create a unique ID for this download to avoid conflicts
  const downloadId = `readlite-download-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  try {
    // Create blob if content is string
    const blob =
      typeof content === "string"
        ? new Blob([content], { type: mimeType })
        : content;

    // First try using Plasmo/Chrome Extension API if available
    if (
      typeof chrome !== "undefined" &&
      chrome.downloads &&
      chrome.downloads.download
    ) {
      try {
        // Create a URL from the blob
        const url = URL.createObjectURL(blob);

        // Use Chrome's download API (available in extensions)
        chrome.downloads.download(
          {
            url: url,
            filename: filename,
            saveAs: true,
          },
          (downloadId) => {
            // Clean up the URL after download starts
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          },
        );
        return;
      } catch (e) {
        logger.error("Chrome extension download API failed:", e);
        // Continue to fallback methods
      }
    }

    // Create an isolated container for the download element
    // This minimizes interactions with other scripts
    const container = document.createElement("div");
    container.id = downloadId;
    container.style.position = "fixed";
    container.style.top = "-9999px";
    container.style.left = "-9999px";
    container.style.width = "1px";
    container.style.height = "1px";
    container.style.opacity = "0";
    container.style.pointerEvents = "none";
    container.setAttribute("aria-hidden", "true");
    container.setAttribute("data-readlite", "download-container");

    // Add the container to the document
    document.body.appendChild(container);

    // Fallback method using a download link
    try {
      const url = URL.createObjectURL(blob);

      // Create link element
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.id = `${downloadId}-link`;
      a.setAttribute("data-readlite", "download-link");

      // Add to isolated container
      container.appendChild(a);

      // Click the link using a custom event to minimize interference
      const clickEvent = new MouseEvent("click", {
        view: window,
        bubbles: false,
        cancelable: true,
        // Important: make this non-bubbling to avoid triggering other handlers
      });

      // Log before clicking

      // Dispatch the event
      a.dispatchEvent(clickEvent);

      // Clean up after a delay
      setTimeout(() => {
        try {
          if (document.body.contains(container)) {
            document.body.removeChild(container);
          }
          URL.revokeObjectURL(url);
        } catch (cleanupError) {
          logger.error("Error during cleanup:", cleanupError);
        }
      }, 2000);

      return;
    } catch (downloadError) {
      logger.error("Standard download method failed:", downloadError);

      // Clean up the container if it's still in the DOM
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }

      // Continue to next fallback
    }

    // Final fallback: open in new tab
    try {
      const url = URL.createObjectURL(blob);

      // Instead of window.open which might be affected by popups
      // Create an isolated iframe then navigate it
      const frame = document.createElement("iframe");
      frame.style.display = "none";
      document.body.appendChild(frame);

      // Get the frame's window and location
      const frameWindow = frame.contentWindow;
      if (frameWindow) {
        frameWindow.location.href = url;

        // Clean up after a delay
        setTimeout(() => {
          document.body.removeChild(frame);
          URL.revokeObjectURL(url);
        }, 2000);
      } else {
        // If we can't access the frame window, try direct navigation
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    } catch (finalError) {
      logger.error("All download methods failed:", finalError);

      // Show user-friendly message
      if (typeof content === "string") {
        alert(
          `Download failed. Try again or copy the first part of the content: ${content.substring(0, 100)}...`,
        );
      } else {
        alert(
          "Download failed. Please try again or check console for details.",
        );
      }
    }
  } catch (criticalError) {
    logger.error("Critical error in download function:", criticalError);
    alert(
      "A problem occurred while trying to download. Please try again later.",
    );
  }
}

/**
 * Export HTML content as a Markdown file
 * @param title - Article title
 * @param content - HTML content
 */
export const exportAsMarkdown = (title: string, content: string): void => {
  try {
    // Just use the provided content - simpler and more reliable
    if (!content || content.trim().length === 0) {
      throw new Error("No content found to export");
    }

    // Convert to Markdown
    const markdown = htmlToMarkdown(content);
    const markdownWithTitle = `# ${title}\n\n${markdown}`;
    const filename = generateFilename(title, "md");

    // Trigger download
    downloadFile(markdownWithTitle, filename, "text/markdown;charset=utf-8");
  } catch (error) {
    logger.error("Error exporting as Markdown:", error);
    alert("Failed to export Markdown. Please try again.");
  }
};

// Add Chrome API type declarations for TypeScript
declare namespace chrome {
  namespace downloads {
    function download(
      options: {
        url: string;
        filename?: string;
        saveAs?: boolean;
      },
      callback?: (downloadId?: number) => void,
    ): void;
  }
}
