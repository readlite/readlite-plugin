/**
 * Context Pack Builder
 * Implements viewport-first scoring and builds context upward only as needed
 * Preserves verbatim spans for numbers/units/dates
 */

import { 
  ContextPack, 
  SentenceAnchor, 
  Contradiction, 
  EvidenceSlate,
  TableStructure,
  FigureContext
} from './types';
import { SentenceSegmenter } from './SentenceSegmenter';
import { createLogger } from '../../utils/logger';

const logger = createLogger('context-pack-builder');

export class ContextPackBuilder {
  private sentenceSegmenter: SentenceSegmenter;
  private maxPrimaryEvidence = 5; // Maximum sentences for primary evidence
  private maxNeighborEvidence = 3; // Maximum neighbor sentences
  private maxSectionContext = 2; // Maximum section gists

  constructor(sentenceSegmenter: SentenceSegmenter) {
    this.sentenceSegmenter = sentenceSegmenter;
  }

  /**
   * Build context pack with viewport-first scoring
   */
  buildContextPack(
    question: string,
    selection?: Range,
    container?: Element
  ): ContextPack {
    logger.info('Building context pack for question:', question);

    // Get all sentence anchors
    const allAnchors = this.sentenceSegmenter.getAllAnchors();
    
    if (allAnchors.length === 0) {
      logger.warn('No sentence anchors available');
      return this.createEmptyContextPack();
    }

    // Apply viewport-first scoring
    const primaryEvidence = this.getPrimaryEvidence(allAnchors, question);
    const neighborEvidence = this.getNeighborEvidence(allAnchors, primaryEvidence);
    const sectionContext = this.getSectionContext(allAnchors, primaryEvidence);
    const numericFacts = this.extractNumericFacts(allAnchors);
    
    // Detect contradictions
    const contradictions = this.detectContradictions(allAnchors);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(primaryEvidence, neighborEvidence, question);

    const contextPack: ContextPack = {
      primaryEvidence,
      neighborEvidence,
      sectionContext,
      numericFacts,
      confidence,
      contradictions
    };

    logger.info(`Built context pack with ${primaryEvidence.length} primary, ${neighborEvidence.length} neighbor evidence`);
    return contextPack;
  }

  /**
   * Get primary evidence (×3 weight) - viewport-visible sentences
   */
  private getPrimaryEvidence(anchors: SentenceAnchor[], question: string): SentenceAnchor[] {
    const viewportAnchors = this.sentenceSegmenter.getViewportAnchors();
    
    // Score and rank viewport anchors by relevance to question
    const scoredAnchors = viewportAnchors.map(anchor => ({
      anchor,
      score: this.calculateRelevanceScore(anchor, question)
    }));

    // Sort by score and take top results
    scoredAnchors.sort((a, b) => b.score - a.score);
    
    return scoredAnchors
      .slice(0, this.maxPrimaryEvidence)
      .map(item => item.anchor);
  }

  /**
   * Get neighbor evidence (×1 weight) - sentences adjacent to primary evidence
   */
  private getNeighborEvidence(anchors: SentenceAnchor[], primaryEvidence: SentenceAnchor[]): SentenceAnchor[] {
    const neighborIds = new Set<string>();
    
    primaryEvidence.forEach(primary => {
      primary.position.neighbors.forEach(neighborIndex => {
        const neighbor = anchors[neighborIndex];
        if (neighbor) {
          neighborIds.add(neighbor.id);
        }
      });
    });

    const neighborAnchors = anchors.filter(anchor => neighborIds.has(anchor.id));
    
    // Limit neighbor evidence
    return neighborAnchors.slice(0, this.maxNeighborEvidence);
  }

  /**
   * Get section context - 1-sentence gists of relevant sections
   */
  private getSectionContext(anchors: SentenceAnchor[], primaryEvidence: SentenceAnchor[]): string[] {
    const sectionIndices = new Set<number>();
    
    primaryEvidence.forEach(primary => {
      sectionIndices.add(primary.position.sectionIndex);
    });

    const sectionContext: string[] = [];
    
    sectionIndices.forEach(sectionIndex => {
      const sectionAnchors = anchors.filter(anchor => anchor.position.sectionIndex === sectionIndex);
      if (sectionAnchors.length > 0) {
        // Create a gist from the first sentence of the section
        const gist = this.createSectionGist(sectionAnchors[0]);
        sectionContext.push(gist);
      }
    });

    return sectionContext.slice(0, this.maxSectionContext);
  }

  /**
   * Create section gist from anchor
   */
  private createSectionGist(anchor: SentenceAnchor): string {
    // For now, use the anchor text as gist
    // In the future, this could be enhanced with summarization
    return anchor.text;
  }

  /**
   * Extract numeric facts verbatim (preserve numbers/units/dates)
   */
  private extractNumericFacts(anchors: SentenceAnchor[]): string[] {
    const numericFacts: string[] = [];
    
    anchors.forEach(anchor => {
      if (anchor.metadata.hasNumbers || anchor.metadata.hasUnits || anchor.metadata.hasDates) {
        // Extract numeric patterns from the sentence
        const patterns = this.extractNumericPatterns(anchor.text);
        numericFacts.push(...patterns);
      }
    });

    return [...new Set(numericFacts)]; // Remove duplicates
  }

  /**
   * Extract numeric patterns from text
   */
  private extractNumericPatterns(text: string): string[] {
    const patterns: string[] = [];
    
    // Numbers with units
    const numberUnitRegex = /\d+(?:\.\d+)?\s*(?:kg|g|lb|oz|km|m|mi|ft|in|°C|°F|%|px|em|rem|ms|s|min|h|d|w|mo|y)/gi;
    let match;
    while ((match = numberUnitRegex.exec(text)) !== null) {
      patterns.push(match[0]);
    }
    
    // Dates
    const dateRegex = /\b\d{1,4}[-/]\d{1,2}[-/]\d{1,4}\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/gi;
    while ((match = dateRegex.exec(text)) !== null) {
      patterns.push(match[0]);
    }
    
    // Percentages
    const percentageRegex = /\d+(?:\.\d+)?%/g;
    while ((match = percentageRegex.exec(text)) !== null) {
      patterns.push(match[0]);
    }
    
    return patterns;
  }

  /**
   * Detect contradictions in the content
   */
  private detectContradictions(anchors: SentenceAnchor[]): Contradiction[] {
    const contradictions: Contradiction[] = [];
    const conceptMap = new Map<string, Array<{ value: string; source: string; context: string }>>();
    
    // Group sentences by concepts they mention
    anchors.forEach(anchor => {
      const concepts = this.extractConcepts(anchor.text);
      concepts.forEach(concept => {
        if (!conceptMap.has(concept)) {
          conceptMap.set(concept, []);
        }
        
        conceptMap.get(concept)!.push({
          value: anchor.text,
          source: anchor.id,
          context: anchor.text
        });
      });
    });
    
    // Check for contradictions
    conceptMap.forEach((values, concept) => {
      if (values.length > 1) {
        const contradiction = this.checkForContradiction(concept, values);
        if (contradiction) {
          contradictions.push(contradiction);
        }
      }
    });
    
    return contradictions;
  }

  /**
   * Extract concepts from text
   */
  private extractConcepts(text: string): string[] {
    const concepts: string[] = [];
    
    // Simple concept extraction - look for key terms
    const conceptPatterns = [
      /\b(?:temperature|temp|heat|cold)\b/gi,
      /\b(?:speed|velocity|rate)\b/gi,
      /\b(?:size|dimension|length|width|height)\b/gi,
      /\b(?:time|duration|period)\b/gi,
      /\b(?:cost|price|amount|value)\b/gi
    ];
    
    conceptPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        concepts.push(...matches);
      }
    });
    
    return concepts;
  }

  /**
   * Check for contradiction in concept values
   */
  private checkForContradiction(
    concept: string, 
    values: Array<{ value: string; source: string; context: string }>
  ): Contradiction | null {
    // For now, return null - this would need more sophisticated logic
    // to actually detect contradictions
    return null;
  }

  /**
   * Calculate relevance score for anchor
   */
  private calculateRelevanceScore(anchor: SentenceAnchor, question: string): number {
    let score = 0;
    const questionLower = question.toLowerCase();
    const anchorLower = anchor.text.toLowerCase();
    
    // Exact phrase matches
    const questionWords = questionLower.split(/\s+/);
    questionWords.forEach(word => {
      if (word.length > 2 && anchorLower.includes(word)) {
        score += 2;
      }
    });
    
    // Semantic similarity (simple keyword matching)
    if (anchor.metadata.hasNumbers && /\d/.test(questionLower)) {
      score += 3; // Bonus for numeric questions
    }
    
    if (anchor.metadata.hasUnits && /\b(kg|g|lb|oz|km|m|mi|ft|in|°C|°F|%)\b/i.test(questionLower)) {
      score += 2; // Bonus for unit questions
    }
    
    // Rhetorical role bonus
    if (anchor.metadata.rhetoricalRole === 'definition' && /\b(what|define|meaning|is|are)\b/.test(questionLower)) {
      score += 2;
    }
    
    if (anchor.metadata.rhetoricalRole === 'evidence' && /\b(how|why|evidence|proof|show)\b/.test(questionLower)) {
      score += 2;
    }
    
    return score;
  }

  /**
   * Calculate confidence level
   */
  private calculateConfidence(
    primaryEvidence: SentenceAnchor[], 
    neighborEvidence: SentenceAnchor[], 
    question: string
  ): 'high' | 'medium' | 'low' {
    const totalEvidence = primaryEvidence.length + neighborEvidence.length;
    
    if (totalEvidence >= 5) {
      return 'high';
    } else if (totalEvidence >= 2) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Create empty context pack
   */
  private createEmptyContextPack(): ContextPack {
    return {
      primaryEvidence: [],
      neighborEvidence: [],
      sectionContext: [],
      numericFacts: [],
      confidence: 'low',
      contradictions: []
    };
  }

  /**
   * Build evidence slate for extractive-first answering
   */
  buildEvidenceSlate(contextPack: ContextPack): EvidenceSlate {
    const { primaryEvidence, neighborEvidence, numericFacts, confidence } = contextPack;
    
    // Combine all evidence sentences
    const sentences = [...primaryEvidence, ...neighborEvidence];
    
    // For now, return empty tables and figures
    // These would be populated by table/figure parsers
    const tables: TableStructure[] = [];
    const figures: FigureContext[] = [];
    
    return {
      sentences,
      tables,
      figures,
      numericFacts,
      confidence
    };
  }

  /**
   * Get context pack summary for display
   */
  getContextPackSummary(contextPack: ContextPack): string {
    const { primaryEvidence, neighborEvidence, confidence } = contextPack;
    
    return `Context: ${primaryEvidence.length} primary + ${neighborEvidence.length} neighbor sentences (${confidence} confidence)`;
  }
}