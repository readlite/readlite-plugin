import { useCallback } from "react";
import { parseArticle } from "../utils/parser";
import { createLogger } from "../utils/logger";

// Create a logger for this module
const logger = createLogger("article");

/**
 * Hook for extracting article content from a web page
 * Provides clean API for getting article content on-demand
 */
export const useArticle = () => {
  /**
   * Extract article content from the current page
   * This function should only be called when explicitly requested by user action
   * @returns Promise that resolves to article data or null if extraction fails
   */
  const extractArticle = useCallback(async () => {
    logger.info("On-demand article extraction requested");
    try {
      // Get the current document
      const doc = window.parent.document;

      // Try to parse the article from the page
      const article = await parseArticle(doc);

      if (!article || !article.content) {
        logger.warn("Failed to extract article content");
        return null;
      }

      return article;
    } catch (error) {
      logger.error("Error extracting article:", error);
      return null;
    }
  }, []);

  return { extractArticle };
};
