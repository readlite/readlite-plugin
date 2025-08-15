/**
 * Sentence Segmentation and Anchor System
 * Creates sentence-level anchors (sid-<hash>) using Range API and sentence segmentation
 * Implements viewport-first scoring and neighbor detection
 */

import { SentenceAnchor, ContextType } from './types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('sentence-segmenter');

export class SentenceSegmenter {
  private sentenceAnchors: Map<string, SentenceAnchor> = new Map();
  private viewportBounds: DOMRect | null = null;
  private sectionIndex = 0;

  /**
   * Segment text into sentences and create anchors
   */
  segmentDocument(document: Document, container: Element): SentenceAnchor[] {
    logger.info('Starting document segmentation');
    
    // Clear existing anchors
    this.sentenceAnchors.clear();
    
    // Get viewport bounds for scoring
    this.viewportBounds = this.getViewportBounds();
    
    // Find all text nodes
    const textNodes = this.findTextNodes(container);
    logger.info(`Found ${textNodes.length} text nodes`);
    
    // Segment into sentences
    const sentences = this.segmentTextNodes(textNodes);
    logger.info(`Segmented into ${sentences.length} sentences`);
    
    // Create anchors for each sentence
    const anchors: SentenceAnchor[] = [];
    
    sentences.forEach((sentence, index) => {
      const anchor = this.createSentenceAnchor(sentence, index);
      if (anchor) {
        anchors.push(anchor);
        this.sentenceAnchors.set(anchor.id, anchor);
      }
    });
    
    // Update neighbor relationships
    this.updateNeighborRelationships(anchors);
    
    // Update section indices
    this.updateSectionIndices(anchors);
    
    logger.info(`Created ${anchors.length} sentence anchors`);
    return anchors;
  }

  /**
   * Find all text nodes in the container
   */
  private findTextNodes(container: Element): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.textContent?.trim();
          if (text && text.length > 10) { // Minimum sentence length
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node as Text);
    }

    return textNodes;
  }

  /**
   * Segment text nodes into sentences
   */
  private segmentTextNodes(textNodes: Text[]): Array<{ text: string; range: Range }> {
    const sentences: Array<{ text: string; range: Range }> = [];
    
    textNodes.forEach(textNode => {
      const text = textNode.textContent || '';
      const sentenceRanges = this.segmentTextIntoSentences(textNode, text);
      sentences.push(...sentenceRanges);
    });
    
    return sentences;
  }

  /**
   * Segment text into sentences using punctuation and context
   */
  private segmentTextIntoSentences(textNode: Text, text: string): Array<{ text: string; range: Range }> {
    const sentences: Array<{ text: string; range: Range }> = [];
    
    // Split by sentence endings (., !, ?) followed by space or newline
    const sentenceRegex = /[^.!?]*[.!?](?:\s|$)/g;
    let match;
    let lastIndex = 0;
    
    while ((match = sentenceRegex.exec(text)) !== null) {
      const sentenceText = match[0].trim();
      if (sentenceText.length > 10) { // Minimum sentence length
        const startOffset = lastIndex;
        const endOffset = lastIndex + match[0].length;
        
        try {
          const range = document.createRange();
          range.setStart(textNode, startOffset);
          range.setEnd(textNode, endOffset);
          
          sentences.push({
            text: sentenceText,
            range
          });
        } catch (error) {
          logger.warn('Failed to create range for sentence:', error);
        }
      }
      lastIndex = match.index + match[0].length;
    }
    
    // Handle remaining text if it's substantial
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex).trim();
      if (remainingText.length > 10) {
        try {
          const range = document.createRange();
          range.setStart(textNode, lastIndex);
          range.setEnd(textNode, text.length);
          
          sentences.push({
            text: remainingText,
            range
          });
        } catch (error) {
          logger.warn('Failed to create range for remaining text:', error);
        }
      }
    }
    
    return sentences;
  }

  /**
   * Create a sentence anchor with metadata
   */
  private createSentenceAnchor(
    sentence: { text: string; range: Range }, 
    index: number
  ): SentenceAnchor | null {
    try {
      const id = this.generateSentenceId(sentence.text, index);
      const rect = sentence.range.getBoundingClientRect();
      
      // Check if sentence is fully visible in viewport
      const isViewport = this.isFullyVisible(rect);
      
      // Analyze sentence metadata
      const metadata = this.analyzeSentenceMetadata(sentence.text);
      
      const anchor: SentenceAnchor = {
        id,
        text: sentence.text,
        range: sentence.range.cloneRange(),
        position: {
          viewport: isViewport,
          neighbors: [], // Will be updated later
          sectionIndex: this.sectionIndex
        },
        metadata
      };
      
      return anchor;
    } catch (error) {
      logger.error('Failed to create sentence anchor:', error);
      return null;
    }
  }

  /**
   * Generate unique sentence ID
   */
  private generateSentenceId(text: string, index: number): string {
    const hash = this.simpleHash(text + index);
    return `sid-${hash}`;
  }

  /**
   * Simple hash function for sentence IDs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if element is fully visible in viewport
   */
  private isFullyVisible(rect: DOMRect): boolean {
    if (!this.viewportBounds) return false;
    
    return (
      rect.top >= this.viewportBounds.top &&
      rect.bottom <= this.viewportBounds.bottom &&
      rect.left >= this.viewportBounds.left &&
      rect.right <= this.viewportBounds.right
    );
  }

  /**
   * Analyze sentence metadata
   */
  private analyzeSentenceMetadata(text: string): SentenceAnchor['metadata'] {
    const hasNumbers = /\d/.test(text);
    const hasUnits = /\b(kg|g|lb|oz|km|m|mi|ft|in|°C|°F|%|px|em|rem|ms|s|min|h|d|w|mo|y)\b/i.test(text);
    const hasDates = /\b\d{1,4}[-/]\d{1,2}[-/]\d{1,4}\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(text);
    
    // Determine rhetorical role based on content and structure
    const rhetoricalRole = this.determineRhetoricalRole(text);
    
    return {
      hasNumbers,
      hasUnits,
      hasDates,
      rhetoricalRole
    };
  }

  /**
   * Determine rhetorical role of sentence
   */
  private determineRhetoricalRole(text: string): SentenceAnchor['metadata']['rhetoricalRole'] {
    const lowerText = text.toLowerCase();
    
    // Definition indicators
    if (/\b(is|are|means|refers to|defined as|consists of)\b/.test(lowerText)) {
      return 'definition';
    }
    
    // Claim indicators
    if (/\b(claim|argue|suggest|propose|believe|think|conclude)\b/.test(lowerText)) {
      return 'claim';
    }
    
    // Evidence indicators
    if (/\b(study|research|data|evidence|shows|demonstrates|indicates|reveals)\b/.test(lowerText)) {
      return 'evidence';
    }
    
    // Limitation indicators
    if (/\b(however|but|although|despite|nevertheless|limitation|constraint|restriction)\b/.test(lowerText)) {
      return 'limitation';
    }
    
    return 'context';
  }

  /**
   * Update neighbor relationships between sentences
   */
  private updateNeighborRelationships(anchors: SentenceAnchor[]): void {
    anchors.forEach((anchor, index) => {
      const neighbors: number[] = [];
      
      // Add previous sentence if exists
      if (index > 0) {
        neighbors.push(index - 1);
      }
      
      // Add next sentence if exists
      if (index < anchors.length - 1) {
        neighbors.push(index + 1);
      }
      
      anchor.position.neighbors = neighbors;
    });
  }

  /**
   * Update section indices based on content structure
   */
  private updateSectionIndices(anchors: SentenceAnchor[]): void {
    let currentSection = 0;
    
    anchors.forEach((anchor, index) => {
      // Detect section breaks (headers, large spacing, etc.)
      if (index > 0) {
        const prevAnchor = anchors[index - 1];
        const isSectionBreak = this.isSectionBreak(prevAnchor, anchor);
        
        if (isSectionBreak) {
          currentSection++;
        }
      }
      
      anchor.position.sectionIndex = currentSection;
    });
  }

  /**
   * Detect section breaks between sentences
   */
  private isSectionBreak(prev: SentenceAnchor, current: SentenceAnchor): boolean {
    // Check for headers (all caps, short length)
    if (current.text.length < 50 && current.text === current.text.toUpperCase()) {
      return true;
    }
    
    // Check for large vertical spacing
    const prevRect = prev.range.getBoundingClientRect();
    const currentRect = current.range.getBoundingClientRect();
    const spacing = currentRect.top - prevRect.bottom;
    
    if (spacing > 30) { // 30px threshold for section break
      return true;
    }
    
    return false;
  }

  /**
   * Get viewport bounds
   */
  private getViewportBounds(): DOMRect {
    return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  }

  /**
   * Get anchor by ID
   */
  getAnchor(id: string): SentenceAnchor | undefined {
    return this.sentenceAnchors.get(id);
  }

  /**
   * Get all anchors
   */
  getAllAnchors(): SentenceAnchor[] {
    return Array.from(this.sentenceAnchors.values());
  }

  /**
   * Get viewport-visible anchors (×3 weight)
   */
  getViewportAnchors(): SentenceAnchor[] {
    return this.getAllAnchors().filter(anchor => anchor.position.viewport);
  }

  /**
   * Get neighbor anchors (×1 weight)
   */
  getNeighborAnchors(): SentenceAnchor[] {
    const viewportAnchors = this.getViewportAnchors();
    const neighborIds = new Set<string>();
    
    viewportAnchors.forEach(anchor => {
      anchor.position.neighbors.forEach(neighborIndex => {
        const neighbor = this.getAllAnchors()[neighborIndex];
        if (neighbor) {
          neighborIds.add(neighbor.id);
        }
      });
    });
    
    return this.getAllAnchors().filter(anchor => neighborIds.has(anchor.id));
  }

  /**
   * Clear all anchors
   */
  clear(): void {
    this.sentenceAnchors.clear();
    this.viewportBounds = null;
    this.sectionIndex = 0;
  }
}