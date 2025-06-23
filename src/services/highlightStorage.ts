/**
 * Highlight Storage Service
 * Manages persistence of highlights in browser extension storage
 */

import { Storage } from "@plasmohq/storage";
import { StoredHighlight } from "../types/highlights";
import { createLogger } from "../utils/logger";

// Create a logger for this module
const logger = createLogger('highlights');

// Create storage instance using Plasmo API
const storage = new Storage({ area: "local" });
const HIGHLIGHT_KEY = "readlite-highlights";

export class HighlightStorage {
  /**
   * Get all highlights for a specific URL
   * @param url The page URL to filter highlights for
   * @returns Promise resolving to array of highlights for the page
   */
  async getPageHighlights(url: string): Promise<StoredHighlight[]> {
    try {
      const allHighlights = await this.getAllHighlights();
      return allHighlights.filter(h => h.url === url);
    } catch (error) {
      logger.error("Error fetching page highlights:", error);
      return [];
    }
  }
  
  /**
   * Save a new highlight to storage
   * @param highlight The highlight data to save
   */
  async saveHighlight(highlight: StoredHighlight): Promise<void> {
    try {
      const highlights = await this.getAllHighlights();
      highlights.push(highlight);
      await storage.set(HIGHLIGHT_KEY, JSON.stringify(highlights));
      logger.info(`Saved highlight ${highlight.id} for ${highlight.url}`);
    } catch (error) {
      logger.error("Error saving highlight:", error);
    }
  }
  
  /**
   * Update an existing highlight
   * @param id ID of the highlight to update
   * @param updates Partial highlight data to update
   * @returns Promise resolving to boolean indicating success
   */
  async updateHighlight(id: string, updates: Partial<StoredHighlight>): Promise<boolean> {
    try {
      const highlights = await this.getAllHighlights();
      const index = highlights.findIndex(h => h.id === id);
      
      if (index === -1) return false;
      
      highlights[index] = {
        ...highlights[index],
        ...updates,
        updatedAt: Date.now()
      };
      
      await storage.set(HIGHLIGHT_KEY, JSON.stringify(highlights));
      logger.info(`Updated highlight ${id}`);
      return true;
    } catch (error) {
      logger.error("Error updating highlight:", error);
      return false;
    }
  }
  
  /**
   * Delete a highlight from storage
   * @param id ID of the highlight to delete
   * @returns Promise resolving to boolean indicating success
   */
  async deleteHighlight(id: string): Promise<boolean> {
    try {
      const highlights = await this.getAllHighlights();
      const filteredHighlights = highlights.filter(h => h.id !== id);
      
      if (filteredHighlights.length === highlights.length) return false;
      
      await storage.set(HIGHLIGHT_KEY, JSON.stringify(filteredHighlights));
      logger.info(`Deleted highlight ${id}`);
      return true;
    } catch (error) {
      logger.error("Error deleting highlight:", error);
      return false;
    }
  }
  
  /**
   * Get all stored highlights
   * @returns Promise resolving to array of all highlights
   */
  async getAllHighlights(): Promise<StoredHighlight[]> {
    try {
      const data = await storage.get(HIGHLIGHT_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      logger.error("Error getting all highlights:", error);
      return [];
    }
  }
}

// Export singleton instance
export const highlightStorage = new HighlightStorage(); 