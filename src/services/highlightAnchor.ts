/**
 * Highlight Anchor Service
 * Provides utilities for locating and anchoring highlights within text content
 */

import { createLogger } from "../utils/logger";
import { StoredHighlight } from '../types/highlights';

const logger = createLogger('highlightAnchor');

// Helper to escape special regex characters
const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export class HighlightAnchor {
  /**
   * Creates anchoring data for a text node to enable future highlighting
   * @param node The text node or element containing highlighted text
   * @param text The highlighted text
   * @returns Object with context information for anchoring
   */
  createAnchorData(node: Node, text: string): Pick<StoredHighlight, 'textBefore' | 'textAfter' | 'domPath' | 'nodeIndex'> {
    try {
      // Get the content and normalize whitespace
      const content = node.textContent || '';
      
      // Normalize both the content and the search text to improve matching
      const normalizedContent = content.replace(/\s+/g, ' ');
      const normalizedText = text.replace(/\s+/g, ' ').trim();
      
      // Try to find the text in the content
      let textIndex = normalizedContent.indexOf(normalizedText);
      
      // If exact match not found, try progressive matching strategies
      if (textIndex === -1 && normalizedText.length > 10) {
        // Try matching first portion of text (useful for CJK languages)
        const firstPortion = normalizedText.substring(0, Math.min(normalizedText.length, 20));
        textIndex = normalizedContent.indexOf(firstPortion);
        
        if (textIndex !== -1) {
          logger.info(`Using partial match for text "${normalizedText.substring(0, 20)}..."`);
        } else {
          // Try individual character matching for CJK text
          // (CJK characters often have no whitespace between them)
          for (let i = 0; i < Math.min(normalizedText.length, 10); i++) {
            const charPattern = normalizedText.substring(i, i + 5);
            if (charPattern.length >= 3) {
              textIndex = normalizedContent.indexOf(charPattern);
              if (textIndex !== -1) {
                logger.info(`Found character pattern match for "${charPattern}" in "${normalizedText.substring(0, 20)}..."`);
                break;
              }
            }
          }
        }
      }
      
      // Calculate DOM path as alternate location method
      const domPath = this.getDomPath(node.parentElement || document.body);
      
      // Calculate the node index for uniqueness
      const nodeIndex = this.getNodeIndex(node);
      
      if (textIndex === -1) {
        logger.warn(`Text "${text.substring(0, 20)}..." not found in node content, using fallback positioning`);
        
        // Return a partial result with DOM path but empty context
        return { 
          textBefore: '', 
          textAfter: '', 
          domPath, 
          nodeIndex 
        };
      }
      
      // Extract surrounding context (max 100 chars for CJK, which often needs more context)
      const contextLength = 100;
      const textBefore = normalizedContent.substring(Math.max(0, textIndex - contextLength), textIndex);
      const textAfter = normalizedContent.substring(
        textIndex + Math.min(normalizedText.length, normalizedContent.length - textIndex), 
        Math.min(normalizedContent.length, textIndex + normalizedText.length + contextLength)
      );
      
      logger.info(`Created anchor data for text "${text.substring(0, 20)}..."`);
      return { textBefore, textAfter, domPath, nodeIndex };
    } catch (error) {
      logger.error("Error creating anchor data:", error);
      return { textBefore: '', textAfter: '', domPath: [], nodeIndex: 0 };
    }
  }
  
  /**
   * Creates anchoring data using W3C TextQuoteSelector and TextPositionSelector standards
   * @param root The root element containing the text
   * @param range The selection range
   * @param context Number of context characters to include before/after
   * @returns Enhanced anchoring data with quote and position selectors
   */
  createSelectorData(
    root: Node,
    range: Range,
    context = 30
  ): Pick<StoredHighlight, 'textBefore' | 'textAfter' | 'domPath' | 'nodeIndex' | 'start' | 'end'> & { exact: string } {
    try {
      // Get the full text content of the root
      const fullText = root.textContent || '';
      
      // Initialize position tracking
      let start = 0;
      let end = 0;
      let passed = false;
      
      // Create a TreeWalker to iterate through all text nodes
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      
      // First pass: calculate absolute character positions for the range
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        
        // If we found the start container, add its offset
        if (node === range.startContainer) {
          start += range.startOffset;
          passed = true;
        } else if (!passed) {
          // Not yet reached start, keep adding text lengths
          start += node.data.length;
        }
        
        // If we found the end container, calculate the end position and break
        if (node === range.endContainer) {
          end = start + (range.endOffset - (passed ? range.startOffset : 0));
          break;
        }
        
        // Between start and end, keep adding to the end position
        if (passed) end += node.data.length;
      }
      
      // Extract the exact text and context
      const exact = fullText.slice(start, end);
      const textBefore = fullText.slice(Math.max(0, start - context), start);
      const textAfter = fullText.slice(end, Math.min(fullText.length, end + context));
      
      // Also add traditional DOM path for backward compatibility
      const domPath = this.getDomPath(range.startContainer.parentElement || document.body);
      
      // Calculate node index for uniqueness
      const nodeIndex = this.getNodeIndex(range.startContainer);
      
      logger.info(`Created selector data for text "${exact.substring(0, 20)}..."`);
      logger.info(`Position selector: start=${start}, end=${end}`);
      logger.info(`Quote selector: prefix="${textBefore}", suffix="${textAfter}"`);
      
      return { textBefore, textAfter, domPath, nodeIndex, exact, start, end };
    } catch (error) {
      logger.error("Error creating selector data:", error);
      return { textBefore: '', textAfter: '', domPath: [], nodeIndex: 0, exact: '', start: 0, end: 0 };
    }
  }
  
  /**
   * Applies a highlight using W3C selector data
   * @param root The root element to search within
   * @param selector The selector data containing exact, prefix, suffix
   * @param highlightId ID for the highlight
   * @param className CSS class for the highlight
   * @returns Boolean indicating success
   */
  applyHighlightWithSelector(
    root: HTMLElement,
    selector: { exact: string; textBefore: string; textAfter: string; start: number; end: number },
    highlightId: string,
    className = 'readlite-highlight'
  ): boolean {
    try {
      const fullText = root.textContent || '';
      
      // First attempt: Exact text matching
      let idx = fullText.indexOf(selector.exact);
      logger.info(`First match attempt: found at index ${idx}`);
      
      // Second attempt: Try with context (prefix/suffix)
      if (idx === -1 && selector.textBefore && selector.textAfter) {
        try {
          // Create a regex pattern with the prefix, the exact text, and the suffix
          // Allow for some whitespace flexibility
          const ctxPattern = new RegExp(
            escapeRegExp(selector.textBefore) + 
            '\\s*' + 
            escapeRegExp(selector.exact) + 
            '\\s*' + 
            escapeRegExp(selector.textAfter)
          );
          
          const match = fullText.match(ctxPattern);
          if (match) {
            // Adjust for the prefix length to find the start of the exact text
            idx = match.index! + selector.textBefore.length;
            logger.info(`Second match attempt: found with context at index ${idx}`);
          }
        } catch (e) {
          logger.error("Error with regex matching:", e);
        }
      }
      
      // Third attempt: Try fuzzy matching for the exact text
      if (idx === -1) {
        let bestMatch = -1;
        let bestScore = 0;
        
        // Simple fuzzy matching - try to find the best substring match
        for (let i = 0; i < fullText.length - 5; i++) {
          const chunk = fullText.substring(i, i + Math.min(50, fullText.length - i));
          const exactChunk = selector.exact.substring(0, Math.min(50, selector.exact.length));
          
          // Calculate similarity score
          let score = 0;
          const minLength = Math.min(chunk.length, exactChunk.length);
          for (let j = 0; j < minLength; j++) {
            if (chunk[j] === exactChunk[j]) score++;
          }
          
          // Normalize score as percentage of match
          const normalizedScore = score / minLength;
          
          // If this is the best match so far and above our threshold, record it
          if (normalizedScore > bestScore && normalizedScore > 0.7) {
            bestScore = normalizedScore;
            bestMatch = i;
          }
        }
        
        if (bestMatch !== -1) {
          idx = bestMatch;
          logger.info(`Third match attempt: found with fuzzy matching at index ${idx} (score: ${bestScore.toFixed(2)})`);
        }
      }
      
      // Fourth attempt: Use the position selector as fallback
      if (idx === -1 && selector.start >= 0 && selector.end > selector.start) {
        idx = selector.start;
        logger.info(`Fourth match attempt: using position selector at index ${idx}`);
      }
      
      // If we still can't find it, give up
      if (idx === -1) {
        logger.warn(`Failed to find text "${selector.exact.substring(0, 30)}..." in content`);
        return false;
      }
      
      // Create a range spanning the matched text
      const range = document.createRange();
      let walked = 0;
      
      // TreeWalker to navigate text nodes
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      
      // Logic to find the start node and offset
      let startNode: Text | null = null;
      let startOffset = 0;
      
      // Find the start position
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const len = node.data.length;
        
        if (walked + len > idx) {
          // Found the node containing our start position
          startNode = node;
          startOffset = idx - walked;
          break;
        }
        
        walked += len;
      }
      
      if (!startNode) {
        logger.warn("Failed to find start node for highlight");
        return false;
      }
      
      // Reset the walker to continue from startNode
      walker.currentNode = startNode;
      
      // Logic to find the end node and offset
      let endNode: Text | null = null;
      let endOffset = 0;
      let exactLength = selector.exact.length;
      
      // Special case: If start node contains the entire highlight
      if (startNode.data.length >= startOffset + exactLength) {
        endNode = startNode;
        endOffset = startOffset + exactLength;
      } else {
        // Find the end position by continuing the walk
        let remainingLength = exactLength - (startNode.data.length - startOffset);
        walked = walked + startNode.data.length;
        
        while (walker.nextNode() && remainingLength > 0) {
          const node = walker.currentNode as Text;
          const len = node.data.length;
          
          if (len >= remainingLength) {
            // This node contains the end of our highlight
            endNode = node;
            endOffset = remainingLength;
            break;
          }
          
          remainingLength -= len;
          walked += len;
        }
      }
      
      if (!endNode) {
        logger.warn("Failed to find end node for highlight");
        return false;
      }
      
      // Set the range boundaries
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      
      // Create multiple highlight spans if we cross element boundaries
      if (startNode !== endNode) {
        logger.info("Complex highlight spanning multiple nodes");
        
        // Get all text nodes in the range
        const textsInRange: Text[] = [];
        const rangeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let inRange = false;
        
        while (rangeWalker.nextNode()) {
          const node = rangeWalker.currentNode as Text;
          
          if (node === startNode) {
            inRange = true;
          }
          
          if (inRange) {
            textsInRange.push(node);
          }
          
          if (node === endNode) {
            break;
          }
        }
        
        // Process each text node to create a highlight group
        textsInRange.forEach((node, i) => {
          try {
            const nodeRange = document.createRange();
            
            // Set correct offsets for first and last nodes
            if (i === 0) {
              // First node
              nodeRange.setStart(node, startOffset);
              nodeRange.setEnd(node, node.length);
            } else if (i === textsInRange.length - 1) {
              // Last node
              nodeRange.setStart(node, 0);
              nodeRange.setEnd(node, endOffset);
            } else {
              // Middle node - highlight the entire thing
              nodeRange.setStart(node, 0);
              nodeRange.setEnd(node, node.length);
            }
            
            // Skip if range is empty
            if (nodeRange.toString().trim() === '') return;
            
            // Create highlight span for this part
            const span = document.createElement('span');
            span.className = className;
            span.dataset.highlightId = highlightId;
            span.dataset.highlightPart = i.toString();
            
            try {
              // Try to wrap
              nodeRange.surroundContents(span);
            } catch (e) {
              logger.warn(`Failed to surround node ${i} with highlight, trying alternative:`, e);
              
              // Alternative approach for complex nodes
              const text = nodeRange.toString();
              if (text) {
                // Split the text node and insert the highlight span
                if (i === 0 && startOffset > 0) {
                  // Split the start if needed
                  const beforeText = node.data.substring(0, startOffset);
                  const selectedText = node.data.substring(startOffset);
                  
                  // Create new nodes
                  const beforeNode = document.createTextNode(beforeText);
                  span.textContent = selectedText;
                  
                  // Replace the original node
                  node.parentNode?.insertBefore(beforeNode, node);
                  node.parentNode?.insertBefore(span, node);
                  node.parentNode?.removeChild(node);
                } else if (i === textsInRange.length - 1 && endOffset < node.length) {
                  // Split the end if needed
                  const selectedText = node.data.substring(0, endOffset);
                  const afterText = node.data.substring(endOffset);
                  
                  // Create new nodes
                  const afterNode = document.createTextNode(afterText);
                  span.textContent = selectedText;
                  
                  // Replace the original node
                  node.parentNode?.insertBefore(span, node);
                  node.parentNode?.insertBefore(afterNode, node);
                  node.parentNode?.removeChild(node);
                } else {
                  // Middle node - replace entirely
                  span.textContent = node.data;
                  node.parentNode?.insertBefore(span, node);
                  node.parentNode?.removeChild(node);
                }
              }
            }
          } catch (nodeError) {
            logger.error(`Error highlighting node ${i}:`, nodeError);
          }
        });
        
        logger.info(`Applied complex highlight with ${textsInRange.length} parts`);
        return true;
      } else {
        // Simple case: Single node highlight
        logger.info("Simple highlight within single node");
        
        // Create the highlight span
        const span = document.createElement('span');
        span.className = className;
        span.dataset.highlightId = highlightId;
        
        try {
          // Try standard surroundContents
          range.surroundContents(span);
          logger.info("Applied simple highlight successfully");
          return true;
        } catch (e) {
          logger.warn("Failed to surround with highlight, trying alternative:", e);
          
          // Alternative approach
          try {
            // Split the text node and insert the highlight span
            const beforeText = startNode.data.substring(0, startOffset);
            const selectedText = startNode.data.substring(startOffset, endOffset);
            const afterText = startNode.data.substring(endOffset);
            
            // Create new nodes
            const beforeNode = document.createTextNode(beforeText);
            const afterNode = document.createTextNode(afterText);
            span.textContent = selectedText;
            
            // Replace the original node
            startNode.parentNode?.insertBefore(beforeNode, startNode);
            startNode.parentNode?.insertBefore(span, startNode);
            startNode.parentNode?.insertBefore(afterNode, startNode);
            startNode.parentNode?.removeChild(startNode);
            
            logger.info("Applied simple highlight with alternative method");
            return true;
          } catch (e2) {
            logger.error("All highlight methods failed:", e2);
            return false;
          }
        }
      }
    } catch (error) {
      logger.error("Error applying highlight with selector:", error);
      return false;
    }
  }
  
  /**
   * Finds text nodes that match a stored highlight
   * Uses multiple strategies for robust text matching
   * @param document The document to search
   * @param highlight The stored highlight data
   * @returns Array of matching text nodes
   */
  findAnchorNodes(document: Document, highlight: StoredHighlight): Node[] {
    try {
      const matchingNodes: Node[] = [];
      
      // Log more details about what we're looking for
      logger.info(`Looking for highlight text: "${highlight.text.substring(0, 50)}${highlight.text.length > 50 ? '...' : ''}"`);
      
      // Normalize the highlight text for consistent comparison
      const normalizedHighlightText = highlight.text.replace(/\s+/g, ' ').trim();
      logger.info(`Normalized highlight text: "${normalizedHighlightText.substring(0, 50)}${normalizedHighlightText.length > 50 ? '...' : ''}"`);
      
      // If we have the DOM path, try to use it first
      if (highlight.domPath && Array.isArray(highlight.domPath) && highlight.domPath.length > 0) {
        try {
          const elementByPath = this.getElementByDomPath(document, highlight.domPath);
          
          if (elementByPath) {
            logger.info(`Found element by DOM path: ${highlight.domPath.join(' > ')}`);
            // If we have text nodes in this element, check them first
            const textNodes = this.getAllTextNodes(elementByPath);
            
            if (textNodes.length > 0) {
              logger.info(`Found ${textNodes.length} text nodes in the target element`);
              
              // If nodeIndex is available, try to get the specific text node
              if (highlight.nodeIndex !== undefined && textNodes[highlight.nodeIndex]) {
                const candidateNode = textNodes[highlight.nodeIndex];
                const candidateText = candidateNode.textContent || '';
                logger.info(`Found node at index ${highlight.nodeIndex}: "${candidateText.substring(0, 50)}${candidateText.length > 50 ? '...' : ''}"`);
                matchingNodes.push(candidateNode);
              } else {
                // Otherwise try to match by content
                for (const node of textNodes) {
                  const content = node.textContent || '';
                  
                  // Normalize both for comparison
                  const normalizedContent = content.replace(/\s+/g, ' ');
                  
                  // Log comparison for debugging
                  logger.info(`Comparing with node text: "${normalizedContent.substring(0, 50)}${normalizedContent.length > 50 ? '...' : ''}"`);
                  
                  // Check for exact match
                  if (normalizedContent.includes(normalizedHighlightText)) {
                    logger.info(`✅ Found exact match`);
                    matchingNodes.push(node);
                  }
                  // For CJK text, also try partial matching
                  else if (normalizedHighlightText.length > 10) {
                    const firstPortion = normalizedHighlightText.substring(0, Math.min(normalizedHighlightText.length, 20));
                    if (normalizedContent.includes(firstPortion)) {
                      logger.info(`✅ Found partial match with first portion: "${firstPortion}"`);
                      matchingNodes.push(node);
                    }
                    else {
                      // Enhanced CJK character sequence matching
                      // Try multiple overlapping segments of the text
                      let foundMatch = false;
                      for (let i = 0; i < Math.min(normalizedHighlightText.length, 20); i += 5) {
                        const charPattern = normalizedHighlightText.substring(i, i + 10);
                        if (charPattern.length >= 3 && normalizedContent.includes(charPattern)) {
                          logger.info(`✅ Found character pattern match: "${charPattern}"`);
                          matchingNodes.push(node);
                          foundMatch = true;
                          break;
                        }
                      }
                      
                      if (!foundMatch) {
                        logger.info(`❌ No match found in this node`);
                      }
                    }
                  }
                }
              }
            } else {
              logger.info(`No text nodes found in element from DOM path`);
            }
          } else {
            logger.info(`Could not find element by DOM path: ${highlight.domPath.join(' > ')}`);
          }
        } catch (e) {
          logger.error("Error finding node by DOM path:", e);
        }
      } else {
        logger.info("No valid DOM path in highlight data, will use text-based search only");
      }
      
      // If no nodes found using DOM path, fall back to text-based search
      if (matchingNodes.length === 0) {
        logger.info(`No matches found by DOM path, trying text-based search`);
        
        // Try to find matches using surrounding context
        if (highlight.textBefore || highlight.textAfter) {
          const allTextNodes = this.getAllTextNodes(document.body);
          logger.info(`Searching through ${allTextNodes.length} text nodes in document body using context`);
          
          for (const node of allTextNodes) {
            const content = node.textContent || '';
            const normalizedContent = content.replace(/\s+/g, ' ');
            
            // Check if node contains the text or surrounding context
            if (normalizedContent.includes(normalizedHighlightText)) {
              logger.info(`✅ Found text in node: "${content.substring(0, 30)}..."`);
              matchingNodes.push(node);
            }
            else if (highlight.textBefore && normalizedContent.includes(highlight.textBefore)) {
              logger.info(`✅ Found text by 'textBefore' context: "${highlight.textBefore}"`);
              matchingNodes.push(node);
            }
            else if (highlight.textAfter && normalizedContent.includes(highlight.textAfter)) {
              logger.info(`✅ Found text by 'textAfter' context: "${highlight.textAfter}"`);
              matchingNodes.push(node);
            }
            // For CJK text, try additional matching strategies
            else if (normalizedHighlightText.length > 10) {
              // Try with first portion
              const firstPortion = normalizedHighlightText.substring(0, Math.min(normalizedHighlightText.length, 20));
              if (normalizedContent.includes(firstPortion)) {
                logger.info(`✅ Found partial match with first portion: "${firstPortion}"`);
                matchingNodes.push(node);
                continue;
              }
              
              // Try with middle portion (for cases where beginning or end might be truncated)
              const middleStart = Math.max(0, Math.floor(normalizedHighlightText.length / 2) - 10);
              const middlePortion = normalizedHighlightText.substring(middleStart, middleStart + 20);
              if (middlePortion.length >= 10 && normalizedContent.includes(middlePortion)) {
                logger.info(`✅ Found partial match with middle portion: "${middlePortion}"`);
                matchingNodes.push(node);
                continue;
              }
              
              // Try smaller chunks for more flexibility with CJK text
              let foundMatch = false;
              for (let i = 0; i < Math.min(normalizedHighlightText.length, 30); i += 5) {
                const charPattern = normalizedHighlightText.substring(i, i + 8);
                if (charPattern.length >= 3 && normalizedContent.includes(charPattern)) {
                  logger.info(`✅ Found character pattern match: "${charPattern}"`);
                  matchingNodes.push(node);
                  foundMatch = true;
                  break;
                }
              }
            }
          }
        }
        // If we couldn't find any nodes with context, try a broader approach
        else {
          // Search the entire document for the text
          const allTextNodes = this.getAllTextNodes(document.body);
          logger.info(`Searching through ${allTextNodes.length} text nodes with full text search`);
          
          for (const node of allTextNodes) {
            const content = node.textContent || '';
            
            // Try normalized text comparison
            const normalizedContent = content.replace(/\s+/g, ' ');
            
            if (normalizedContent.includes(normalizedHighlightText)) {
              logger.info(`✅ Found exact match in node: "${content.substring(0, 30)}..."`);
              matchingNodes.push(node);
            }
            // Try partial matching for longer texts (common in CJK languages)
            else if (normalizedHighlightText.length > 10) {
              // Try with first, middle, and end portions for more flexible matching
              const firstPortion = normalizedHighlightText.substring(0, Math.min(normalizedHighlightText.length, 20));
              if (normalizedContent.includes(firstPortion)) {
                logger.info(`✅ Found partial match with first portion: "${firstPortion}"`);
                matchingNodes.push(node);
                continue;
              }
              
              // Try with middle portion
              const middleStart = Math.max(0, Math.floor(normalizedHighlightText.length / 2) - 10);
              const middlePortion = normalizedHighlightText.substring(middleStart, middleStart + 20);
              if (middlePortion.length >= 10 && normalizedContent.includes(middlePortion)) {
                logger.info(`✅ Found partial match with middle portion: "${middlePortion}"`);
                matchingNodes.push(node);
                continue;
              }
              
              // Try with last portion
              const lastPortion = normalizedHighlightText.substring(
                Math.max(0, normalizedHighlightText.length - 20)
              );
              if (lastPortion.length >= 10 && normalizedContent.includes(lastPortion)) {
                logger.info(`✅ Found partial match with last portion: "${lastPortion}"`);
                matchingNodes.push(node);
                continue;
              }
              
              // Try smaller chunks for very flexible matching with CJK text
              let foundMatch = false;
              const chunkSize = 8; // Use 8-character chunks
              for (let i = 0; i < normalizedHighlightText.length - chunkSize; i += 4) { // Overlap by 4 chars
                const charPattern = normalizedHighlightText.substring(i, i + chunkSize);
                if (charPattern.length >= 3 && normalizedContent.includes(charPattern)) {
                  logger.info(`✅ Found character pattern match: "${charPattern}"`);
                  matchingNodes.push(node);
                  foundMatch = true;
                  break;
                }
              }
            }
          }
        }
      }
      
      if (matchingNodes.length > 0) {
        logger.info(`Found ${matchingNodes.length} potential nodes for text "${highlight.text.substring(0, 20)}..."`);
      } else {
        logger.warn(`No nodes found for text "${highlight.text.substring(0, 20)}..."`);
      }
      
      return matchingNodes;
    } catch (error) {
      logger.error("Error finding anchor nodes:", error);
      return [];
    }
  }
  
  /**
   * Gets all text nodes in a container
   * @param node The container node
   * @returns Array of text nodes
   */
  private getAllTextNodes(node: Node): Node[] {
    const textNodes: Node[] = [];
    
    // Use TreeWalker for efficient DOM traversal
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
   * Computes a unique DOM path for an element
   * @param element The element to get path for
   * @returns Array of selectors representing the DOM path
   */
  private getDomPath(element: Element): string[] {
    try {
      const path: string[] = [];
      let currentNode = element;
      
      // Try to find the article container element to use as a root
      const findArticleContainer = (el: Element): Element | null => {
        let current = el;
        // Walk up the DOM tree looking for article container indicators
        while (current && current !== document.body) {
          // Look for common article container indicators
          if (
            current.tagName === 'ARTICLE' || 
            current.classList.contains('article') || 
            current.classList.contains('content') ||
            current.classList.contains('article-content') ||
            current.classList.contains('post-content') ||
            current.classList.contains('readlite-reader-container') ||
            current.id === 'article' ||
            current.id === 'content' ||
            current.getAttribute('role') === 'main'
          ) {
            return current;
          }
          current = current.parentElement as Element;
        }
        return null;
      };
      
      // Try to find the article container
      const articleContainer = findArticleContainer(element);
      
      // If found, compute path relative to the article container
      if (articleContainer) {
        logger.info(`Found article container for relative path: ${articleContainer.tagName}`);
        
        // Add an identifier for the article container
        let rootIdentifier = articleContainer.tagName.toLowerCase();
        if (articleContainer.id) {
          rootIdentifier += `#${articleContainer.id}`;
        } else if (articleContainer.classList.length > 0) {
          rootIdentifier += `.${Array.from(articleContainer.classList).join('.')}`;
        }
        
        // Start with the article container identifier
        path.push(`article-container[${rootIdentifier}]`);
        
        // Build path from element up to the article container
        while (currentNode && currentNode !== articleContainer) {
          let selector = currentNode.tagName.toLowerCase();
          
          // Add ID if available (for uniqueness)
          if (currentNode.id) {
            selector += `#${currentNode.id}`;
          }
          // Otherwise add a positional index
          else {
            let index = 1;
            let sibling = currentNode.previousElementSibling;
            
            while (sibling) {
              if (sibling.tagName === currentNode.tagName) {
                index++;
              }
              sibling = sibling.previousElementSibling;
            }
            
            if (index > 1) {
              selector += `:nth-of-type(${index})`;
            }
          }
          
          path.unshift(selector);
          
          if (!currentNode.parentElement) break;
          currentNode = currentNode.parentElement;
        }
        
        return path;
      }
      
      // Fallback to traditional approach (relative to body)
      while (currentNode && currentNode !== document.body && currentNode.parentElement) {
        let selector = currentNode.tagName.toLowerCase();
        
        // Add ID if available (for uniqueness)
        if (currentNode.id) {
          selector += `#${currentNode.id}`;
        }
        // Otherwise add a positional index
        else {
          let index = 1;
          let sibling = currentNode.previousElementSibling;
          
          while (sibling) {
            if (sibling.tagName === currentNode.tagName) {
              index++;
            }
            sibling = sibling.previousElementSibling;
          }
          
          if (index > 1) {
            selector += `:nth-of-type(${index})`;
          }
        }
        
        path.unshift(selector);
        currentNode = currentNode.parentElement;
      }
      
      return path;
    } catch (error) {
      logger.error("Error getting DOM path:", error);
      return [];
    }
  }
  
  /**
   * Gets the index of a node among its text node siblings
   * @param node The node to find index for
   * @returns Index of the node
   */
  private getNodeIndex(node: Node): number {
    if (!node.parentNode) return 0;
    
    const siblings = Array.from(node.parentNode.childNodes);
    const textSiblings = siblings.filter(n => n.nodeType === Node.TEXT_NODE);
    
    return textSiblings.indexOf(node as Text);
  }
  
  /**
   * Gets an element by its DOM path
   * Uses different strategies to find the element even when exact path doesn't match
   */
  getElementByDomPath(doc: Document, path: string[]): Element | null {
    try {
      // Check if path is empty or invalid
      if (!path || !Array.isArray(path) || path.length === 0) {
        logger.warn("Cannot find element with empty or invalid DOM path");
        return null;
      }
      
      // Check if we have a special article container marker
      const hasArticleContainer = path[0].startsWith('article-container[');
      
      if (hasArticleContainer) {
        // Extract the article container identifier
        const containerMarker = path[0];
        const match = containerMarker.match(/article-container\[(.*?)\]/);
        
        if (match && match[1]) {
          const containerIdentifier = match[1];
          logger.info(`Looking for article container: ${containerIdentifier}`);
          
          // Try to find the article container first
          const findArticleContainer = (): Element | null => {
            // Try ID-based lookup first
            const idMatch = containerIdentifier.match(/#([^.#]+)/);
            if (idMatch) {
              const containerById = doc.getElementById(idMatch[1]);
              if (containerById) return containerById;
            }
            
            // Try tag-based lookup
            const tagMatch = containerIdentifier.match(/^([a-z0-9]+)/i);
            if (tagMatch) {
              const tag = tagMatch[1];
              
              // Look for elements with this tag that could be article containers
              const candidates = Array.from(doc.getElementsByTagName(tag));
              
              for (const candidate of candidates) {
                // Check if it could be an article container
                if (
                  candidate.classList.contains('article') || 
                  candidate.classList.contains('content') ||
                  candidate.classList.contains('article-content') ||
                  candidate.classList.contains('post-content') ||
                  candidate.classList.contains('readlite-reader-container') ||
                  candidate.getAttribute('role') === 'main'
                ) {
                  return candidate;
                }
              }
            }
            
            // Fallback to broader article container search
            const containers = doc.querySelectorAll('article, [role="main"], .article, .content, .post-content, .readlite-reader-container');
            return containers.length > 0 ? containers[0] as Element : null;
          };
          
          const articleContainer = findArticleContainer();
          
          if (articleContainer) {
            logger.info(`Found article container: ${articleContainer.tagName}`);
            
            // Now find the element relative to the article container
            // Skip the first path component (the article container marker)
            const relativePath = path.slice(1).join(' > ');
            
            if (relativePath) {
              try {
                // Try exact relative path first
                const element = articleContainer.querySelector(relativePath);
                if (element) {
                  logger.info(`Found element with exact relative path`);
                  return element;
                }
              } catch (e) {
                logger.warn(`Error with relative path query:`, e);
              }
              
              // Try more flexible approaches if exact path fails
              // Try with individual segments
              const pathSegments = path.slice(1);
              if (pathSegments.length > 0) {
                // Try the last few segments for more specificity
                const lastSegments = pathSegments.slice(-Math.min(2, pathSegments.length));
                
                try {
                  const query = lastSegments.join(' > ');
                  logger.info(`Trying relative path with last segments: ${query}`);
                  const elements = articleContainer.querySelectorAll(query);
                  if (elements.length > 0) {
                    logger.info(`Found ${elements.length} elements with partial relative path`);
                    return elements[0] as Element;
                  }
                } catch (e) {
                  logger.warn(`Error with partial relative path:`, e);
                }
                
                // Try with tag names only
                const tagOnlySegments = pathSegments.map(segment => {
                  return segment.split(/[:#.[]/) // Remove ID, class, attribute, and pseudo-selectors
                            [0].trim(); // Get just the tag name
                }).filter(Boolean); // Remove any empty entries
                
                if (tagOnlySegments.length > 0) {
                  try {
                    const tagQuery = tagOnlySegments.join(' > ');
                    logger.info(`Trying relative path with tag names only: ${tagQuery}`);
                    const elements = articleContainer.querySelectorAll(tagQuery);
                    if (elements.length > 0) {
                      logger.info(`Found ${elements.length} elements with tag-based relative path`);
                      return elements[0] as Element;
                    }
                  } catch (e) {
                    logger.warn(`Error with tag-based relative path:`, e);
                  }
                }
              }
            }
          }
        }
      }
      
      // Fallback to traditional approach if article container approach fails
      // First try the exact path (most specific)
      try {
        const exactPath = path.join(' > ');
        if (exactPath) {
          logger.info(`Trying exact DOM path: ${exactPath}`);
          const element = doc.querySelector(exactPath);
          if (element) {
            logger.info(`Found element with exact path match`);
            return element;
          }
        }
      } catch (e) {
        logger.warn(`Error with exact path query:`, e);
      }
      
      // If that fails, try a more flexible approach
      // Start with the most specific part of the path (last segments) and try to find it
      let currentPath = [];
      for (let i = Math.max(0, path.length - 3); i < path.length; i++) {
        currentPath.push(path[i]);
      }
      
      if (currentPath.length > 0) {
        try {
          const pathQuery = currentPath.join(' > ');
          logger.info(`Trying partial path (most specific segments): ${pathQuery}`);
          const element = doc.querySelector(pathQuery);
          if (element) {
            logger.info(`Found element with partial path match`);
            return element;
          }
        } catch (e) {
          logger.warn(`Error with partial path query:`, e);
        }
      }
      
      logger.warn(`Could not find element with DOM path: ${path.join(' > ')}`);
      return null;
    } catch (error) {
      logger.error("Error getting element by DOM path:", error);
      return null;
    }
  }
}

export const highlightAnchor = new HighlightAnchor();