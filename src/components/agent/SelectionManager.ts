/**
 * Selection Manager
 * Implements selection-first lens paradigm with Cmd/Ctrl+K support
 * Automatically generates inline answer cards for text selections
 */

import { 
  InlineAnswerCard, 
  SentenceAnchor, 
  ContextPack, 
  EvidenceSlate,
  NumericCard,
  TableStructure
} from './types';
import { SentenceSegmenter } from './SentenceSegmenter';
import { ContextPackBuilder } from './ContextPackBuilder';
import { createLogger } from '../../utils/logger';

const logger = createLogger('selection-manager');

export class SelectionManager {
  private sentenceSegmenter: SentenceSegmenter;
  private contextPackBuilder: ContextPackBuilder;
  private currentSelection: Range | null = null;
  private currentInlineCard: InlineAnswerCard | null = null;
  private isCmdKActive = false;
  private container: Element | null = null;

  constructor(sentenceSegmenter: SentenceSegmenter, contextPackBuilder: ContextPackBuilder) {
    this.sentenceSegmenter = sentenceSegmenter;
    this.contextPackBuilder = contextPackBuilder;
    this.setupEventListeners();
  }

  /**
   * Initialize with container element
   */
  initialize(container: Element): void {
    this.container = container;
    
    // Segment the document to create sentence anchors
    if (container.ownerDocument) {
      this.sentenceSegmenter.segmentDocument(container.ownerDocument, container);
      logger.info('Initialized selection manager with container');
    }
  }

  /**
   * Setup global event listeners
   */
  private setupEventListeners(): void {
    // Cmd/Ctrl+K handler
    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        this.handleCmdK();
      }
    });

    // Selection change handler
    document.addEventListener('selectionchange', () => {
      this.handleSelectionChange();
    });

    // Click outside to close inline card
    document.addEventListener('click', (event) => {
      if (this.currentInlineCard && !this.isClickInCard(event)) {
        this.closeInlineCard();
      }
    });
  }

  /**
   * Handle Cmd/Ctrl+K activation
   */
  private handleCmdK(): void {
    this.isCmdKActive = true;
    
    // If there's a current selection, generate answer immediately
    if (this.currentSelection) {
      this.generateInlineAnswer(this.currentSelection);
    } else {
      // Show prompt to select text
      this.showSelectionPrompt();
    }
    
    logger.info('Cmd/Ctrl+K activated');
  }

  /**
   * Handle selection changes
   */
  private handleSelectionChange(): void {
    const selection = document.getSelection();
    
    if (!selection || selection.rangeCount === 0) {
      this.currentSelection = null;
      return;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      this.currentSelection = null;
      return;
    }

    const selectedText = range.toString().trim();
    if (selectedText.length < 3) {
      this.currentSelection = null;
      return;
    }

    this.currentSelection = range;
    
    // If Cmd/K is active, generate answer immediately
    if (this.isCmdKActive) {
      this.generateInlineAnswer(range);
    }
    
    logger.info(`Selection changed: "${selectedText.substring(0, 50)}..."`);
  }

  /**
   * Generate inline answer for selection
   */
  private async generateInlineAnswer(selection: Range): Promise<void> {
    if (!this.container) return;

    try {
      const selectedText = selection.toString().trim();
      
      // Create a simple question from the selection
      const question = this.createQuestionFromSelection(selectedText);
      
      // Build context pack
      const contextPack = this.contextPackBuilder.buildContextPack(question, selection, this.container);
      
      // Build evidence slate
      const evidenceSlate = this.contextPackBuilder.buildEvidenceSlate(contextPack);
      
      // Generate answer using evidence slate
      const answer = await this.generateAnswerFromEvidence(question, evidenceSlate);
      
      // Create inline answer card
      const inlineCard = this.createInlineAnswerCard(
        question,
        answer,
        selection,
        contextPack,
        evidenceSlate
      );
      
      // Show the inline card
      this.showInlineCard(inlineCard);
      
      logger.info('Generated inline answer for selection');
      
    } catch (error) {
      logger.error('Failed to generate inline answer:', error);
      this.showErrorCard('Failed to generate answer. Please try again.');
    }
  }

  /**
   * Create question from selection
   */
  private createQuestionFromSelection(selectedText: string): string {
    // Simple heuristics to create a question
    if (selectedText.length < 20) {
      return `What does "${selectedText}" mean?`;
    } else if (/\d/.test(selectedText)) {
      return `Can you explain the numbers and data in this selection?`;
    } else {
      return `Can you explain this selection?`;
    }
  }

  /**
   * Generate answer from evidence slate
   */
  private async generateAnswerFromEvidence(question: string, evidenceSlate: EvidenceSlate): Promise<string> {
    // For now, create a simple extractive answer
    // In the future, this would call an LLM with the evidence slate
    
    const { sentences, numericFacts, confidence } = evidenceSlate;
    
    if (sentences.length === 0) {
      return "I don't have enough context to answer this question.";
    }
    
    // Create extractive answer from evidence
    let answer = "";
    
    if (numericFacts.length > 0) {
      answer += `The selection contains ${numericFacts.length} numeric facts: ${numericFacts.slice(0, 3).join(', ')}. `;
    }
    
    // Use the most relevant sentence as the main answer
    const mainSentence = sentences[0];
    answer += mainSentence.text;
    
    // Limit to 2 sentences
    if (answer.length > 200) {
      const sentences = answer.split(/[.!?]+/);
      answer = sentences.slice(0, 2).join('.') + '.';
    }
    
    return answer;
  }

  /**
   * Create inline answer card
   */
  private createInlineAnswerCard(
    question: string,
    answer: string,
    selection: Range,
    contextPack: ContextPack,
    evidenceSlate: EvidenceSlate
  ): InlineAnswerCard {
    // Find the sentence anchor that contains this selection
    const anchor = this.findContainingSentenceAnchor(selection);
    
    // Create citations from evidence
    const citations = evidenceSlate.sentences.map(sentence => `[${sentence.id}]`);
    
    // Generate follow-up questions
    const followUpQuestions = this.generateFollowUpQuestions(evidenceSlate);
    
    // Create numeric card if selection contains numbers
    const numericCard = this.createNumericCard(selection, evidenceSlate);
    
    const inlineCard: InlineAnswerCard = {
      id: `card-${Date.now()}`,
      question,
      answer,
      citations,
      confidence: contextPack.confidence,
      position: {
        x: 0, // Will be calculated by the component
        y: 0,
        anchor: anchor || this.createFallbackAnchor(selection)
      },
      followUpQuestions,
      numericCard
    };
    
    return inlineCard;
  }

  /**
   * Find sentence anchor containing the selection
   */
  private findContainingSentenceAnchor(selection: Range): SentenceAnchor | null {
    const allAnchors = this.sentenceSegmenter.getAllAnchors();
    
    for (const anchor of allAnchors) {
      try {
        if (this.rangesOverlap(selection, anchor.range)) {
          return anchor;
        }
      } catch (error) {
        // Skip anchors with invalid ranges
        continue;
      }
    }
    
    return null;
  }

  /**
   * Check if two ranges overlap
   */
  private rangesOverlap(range1: Range, range2: Range): boolean {
    try {
      return range1.compareBoundaryPoints(Range.START_TO_END, range2) <= 0 &&
             range1.compareBoundaryPoints(Range.END_TO_START, range2) >= 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create fallback anchor if none found
   */
  private createFallbackAnchor(selection: Range): SentenceAnchor {
    const text = selection.toString().trim();
    const range = selection.cloneRange();
    
    return {
      id: `fallback-${Date.now()}`,
      text,
      range,
      position: {
        viewport: true,
        neighbors: [],
        sectionIndex: 0
      },
      metadata: {
        hasNumbers: /\d/.test(text),
        hasUnits: /\b(kg|g|lb|oz|km|m|mi|ft|in|°C|°F|%)\b/i.test(text),
        hasDates: /\b\d{1,4}[-/]\d{1,2}[-/]\d{1,4}\b/.test(text),
        rhetoricalRole: 'context'
      }
    };
  }

  /**
   * Generate follow-up questions based on evidence
   */
  private generateFollowUpQuestions(evidenceSlate: EvidenceSlate): string[] {
    const questions: string[] = [];
    const { sentences } = evidenceSlate;
    
    // Generate questions based on rhetorical roles
    sentences.forEach(sentence => {
      switch (sentence.metadata.rhetoricalRole) {
        case 'definition':
          questions.push(`What are the implications of this definition?`);
          break;
        case 'claim':
          questions.push(`What evidence supports this claim?`);
          break;
        case 'evidence':
          questions.push(`How strong is this evidence?`);
          break;
        case 'limitation':
          questions.push(`How can these limitations be addressed?`);
          break;
        default:
          questions.push(`Can you elaborate on this point?`);
      }
    });
    
    // Limit to 3-5 questions
    return questions.slice(0, 4);
  }

  /**
   * Create numeric card for table/figure selections
   */
  private createNumericCard(selection: Range, evidenceSlate: EvidenceSlate): NumericCard | undefined {
    const text = selection.toString().trim();
    
    // Check if selection looks like table data
    if (/\d/.test(text) && text.length < 50) {
      return {
        value: text,
        unit: this.extractUnit(text),
        sourceSentence: evidenceSlate.sentences[0]?.id || 'unknown'
      };
    }
    
    return undefined;
  }

  /**
   * Extract unit from text
   */
  private extractUnit(text: string): string | undefined {
    const unitMatch = text.match(/\b(kg|g|lb|oz|km|m|mi|ft|in|°C|°F|%|px|em|rem|ms|s|min|h|d|w|mo|y)\b/i);
    return unitMatch ? unitMatch[0] : undefined;
  }

  /**
   * Show inline answer card
   */
  private showInlineCard(card: InlineAnswerCard): void {
    this.currentInlineCard = card;
    
    // Dispatch custom event for the UI to handle
    const event = new CustomEvent('showInlineAnswerCard', { detail: card });
    document.dispatchEvent(event);
    
    logger.info('Showing inline answer card');
  }

  /**
   * Close inline answer card
   */
  private closeInlineCard(): void {
    this.currentInlineCard = null;
    
    // Dispatch custom event for the UI to handle
    const event = new CustomEvent('closeInlineAnswerCard');
    document.dispatchEvent(event);
    
    logger.info('Closed inline answer card');
  }

  /**
   * Show error card
   */
  private showErrorCard(message: string): void {
    const errorCard: InlineAnswerCard = {
      id: `error-${Date.now()}`,
      question: 'Error',
      answer: message,
      citations: [],
      confidence: 'low',
      position: {
        x: 0,
        y: 0,
        anchor: this.createFallbackAnchor(document.createRange())
      },
      followUpQuestions: []
    };
    
    this.showInlineCard(errorCard);
  }

  /**
   * Show selection prompt
   */
  private showSelectionPrompt(): void {
    // Could show a tooltip or notification
    logger.info('Showing selection prompt');
  }

  /**
   * Check if click is inside the inline card
   */
  private isClickInCard(event: MouseEvent): boolean {
    // This would need to be implemented based on the actual card DOM element
    return false;
  }

  /**
   * Get current inline card
   */
  getCurrentInlineCard(): InlineAnswerCard | null {
    return this.currentInlineCard;
  }

  /**
   * Check if Cmd/K is active
   */
  isCmdKActive(): boolean {
    return this.isCmdKActive;
  }

  /**
   * Reset Cmd/K state
   */
  resetCmdKState(): void {
    this.isCmdKActive = false;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // Remove event listeners
    document.removeEventListener('keydown', this.handleCmdK.bind(this));
    document.removeEventListener('selectionchange', this.handleSelectionChange.bind(this));
    document.removeEventListener('click', this.handleClick.bind(this));
    
    this.closeInlineCard();
    this.currentSelection = null;
    this.container = null;
    
    logger.info('Selection manager destroyed');
  }

  // Bind methods for event listeners
  private handleClick = (event: MouseEvent) => {
    if (this.currentInlineCard && !this.isClickInCard(event)) {
      this.closeInlineCard();
    }
  };
}