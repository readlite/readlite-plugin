/**
 * Highlight persistence data types
 * Defines the structure for storing and retrieving highlights
 */

import { HighlightColor } from "../hooks/useTextSelection";

/**
 * Structure for storing highlight data in extension storage
 */
export interface StoredHighlight {
  id: string;                // Unique identifier
  url: string;               // Page URL where highlight exists
  text: string;              // Highlighted text content
  color: HighlightColor;     // Color of the highlight
  note?: string;             // Optional note attached to highlight
  createdAt: number;         // Creation timestamp
  updatedAt: number;         // Last update timestamp
  
  // Anchoring information for locating highlights on page reload
  textBefore: string;        // Text context before highlight (max 50 chars)
  textAfter: string;         // Text context after highlight (max 50 chars)
  domPath?: string[];        // DOM path as fallback location method
  nodeIndex?: number;        // Node index if same text appears multiple times
  
  // W3C TextPositionSelector fields
  start?: number;            // Absolute start position in document text
  end?: number;              // Absolute end position in document text
  
  // Additional W3C TextQuoteSelector fields
  exact?: string;            // The exact text being highlighted
  prefix?: string;           // A snippet of text that precedes the exact match
  suffix?: string;           // A snippet of text that follows the exact match
} 