// New Agent Context System - Selection-First Lens Paradigm
// Based on principles: selection-first, evidence granularity, context pack policy, extractive-first answering

export interface CommonProps {
  t: (key: string) => string;
}

// Sentence-level anchor system
export interface SentenceAnchor {
  id: string; // sid-<hash>
  text: string; // verbatim sentence text
  range: Range; // DOM range for exact highlighting
  position: {
    viewport: boolean; // whether fully visible in viewport
    neighbors: number[]; // indices of neighboring sentences (±1)
    sectionIndex: number; // which section this sentence belongs to
  };
  metadata: {
    hasNumbers: boolean; // contains numeric facts
    hasUnits: boolean; // contains units
    hasDates: boolean; // contains dates
    rhetoricalRole: 'definition' | 'claim' | 'evidence' | 'limitation' | 'context';
  };
}

// Context pack with viewport-first scoring
export interface ContextPack {
  primaryEvidence: SentenceAnchor[]; // ×3 weight (fully visible)
  neighborEvidence: SentenceAnchor[]; // ×1 weight (neighbors)
  sectionContext: string[]; // 1-sentence section gists if needed
  numericFacts: string[]; // verbatim numbers/units/dates
  confidence: 'high' | 'medium' | 'low';
  contradictions: Contradiction[];
}

// Contradiction detection
export interface Contradiction {
  concept: string;
  values: Array<{
    value: string;
    source: string; // sid-xxxx
    context: string;
  }>;
}

// Inline answer card for selection-first paradigm
export interface InlineAnswerCard {
  id: string;
  question: string;
  answer: string; // ≤2 sentences
  citations: string[]; // [sid:xxxx] format
  confidence: 'high' | 'medium' | 'low';
  position: {
    x: number;
    y: number;
    anchor: SentenceAnchor;
  };
  followUpQuestions: string[]; // 3-5 smart questions
  numericCard?: NumericCard; // for table cell selections
}

// Numeric card for table/figure handling
export interface NumericCard {
  value: string;
  unit?: string;
  rowLabel?: string;
  columnLabel?: string;
  sourceSentence: string; // sid-xxxx
  tableContext?: string;
}

// Table structure parsing
export interface TableStructure {
  rows: Array<{
    cells: Array<{
      value: string;
      unit?: string;
      isNumeric: boolean;
    }>;
    label?: string;
  }>;
  columns: Array<{
    header: string;
    unit?: string;
    isNumeric: boolean;
  }>;
}

// Figure context for image questions
export interface FigureContext {
  caption: string;
  explanatorySentence: string; // sid-xxxx
  altText?: string;
  source: string; // sid-xxxx
}

// Reading progress tracking
export interface ReadingProgress {
  keySentences: SentenceAnchor[]; // 8-12 key sentences
  keyTables: TableStructure[]; // 2 key tables
  coverage: number; // 0-100%
  understandingPath: string[]; // shortest path to understanding
}

// Language learning aids
export interface TermCard {
  term: string;
  translation?: string;
  ipa?: string;
  meaning: string;
  sourceSentence: string; // sid-xxxx
  addToReview: boolean;
}

// Simplified English toggle
export interface SimplifiedEnglish {
  original: string;
  simplified: string; // CEFR B1/B2 level
  sourceSentence: string; // sid-xxxx
}

// Evidence slate for extractive-first answering
export interface EvidenceSlate {
  sentences: SentenceAnchor[];
  tables: TableStructure[];
  figures: FigureContext[];
  numericFacts: string[];
  confidence: 'high' | 'medium' | 'low';
}

// Message interface with new context system
export interface Message {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: number;
  thinking?: boolean;
  error?: boolean;
  contextPack?: ContextPack;
  evidenceSlate?: EvidenceSlate;
  inlineCard?: InlineAnswerCard;
  followUpQuestions?: string[];
  readingProgress?: ReadingProgress;
}

// Context types for the new system
export type ContextType = 'selection' | 'viewport' | 'article' | 'table' | 'figure';

// Model interface
export interface Model {
  value: string;
  label: string;
  provider: string;
  maxTokens?: number;
}

// Re-export Model type for convenience
export type { Model }; 