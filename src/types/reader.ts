/**
 * Reader API interfaces for agent interaction
 * Defines the contract between the reader and agent components
 */
import { ThemeType } from "~/config/theme";
import { LanguageCode } from "~/utils/language";

// Definition for scroll position
export interface ScrollPosition {
  type: "top" | "bottom" | "percent";
  value?: number; // Used for percentage (0-100)
}

// Search result interface
export interface SearchResult {
  id: string;
  text: string;
  position: number; // Position in document
  contextBefore: string;
  contextAfter: string;
}

// Highlight interface
export interface Highlight {
  id: string;
  text: string;
  position: number;
  color?: string;
  note?: string;
  createdAt: number;
}

// Reading position interface
export interface ReadingPosition {
  percent: number; // 0-100
  elementId?: string;
  scrollY: number;
}

/**
 * Article data interface
 */
export interface ArticleData {
  title?: string;
  textContent?: string;
  content?: string;
  language?: string;
  length?: number;
  excerpt?: string;
  url?: string;
}

/**
 * Reader API Interface
 * Provides methods for controlling the reader and accessing content
 */
export interface ReaderAPI {
  // Navigation
  scrollTo(position: ScrollPosition): Promise<void>;
  scrollBy(amount: number): Promise<void>;
  turnPage(direction: "next" | "previous"): Promise<void>;
  findAndScrollTo(text: string): Promise<boolean>;

  // Content appearance
  setFontSize(size: number): Promise<void>;
  setFontFamily(font: string): Promise<void>;
  setTheme(theme: string): Promise<void>;
  setLineSpacing(spacing: number): Promise<void>;
  setMargins(size: number): Promise<void>;
  toggleReadingMode(mode: string): Promise<void>;

  // Selection and search
  search(query: string): Promise<SearchResult[]>;
  searchNext(): Promise<boolean>;
  searchPrevious(): Promise<boolean>;
  selectText(text: string): Promise<boolean>;
  getCurrentSelection(): Promise<string>;

  // Highlights and annotations
  highlight(text: string, color?: string): Promise<string>;
  addNote(highlightId: string, note: string): Promise<void>;
  getHighlights(): Promise<Highlight[]>;
  removeHighlight(id: string): Promise<boolean>;

  // Content information
  getWordCount(): Promise<number>;
  getReadingTime(): Promise<number>;
  getCurrentPosition(): Promise<ReadingPosition>;
  getVisibleContent(): Promise<string>;
  getFullContent(): Promise<string>;
  getTableOfContents(): Promise<{ id: string; level: number; title: string }[]>;
}

export interface ReaderSettings {
  theme: ThemeType;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  textAlign: string;
  width: number;
}

export interface Article {
  title?: string;
  byline?: string;
  content?: string;
}

export interface ReaderContentProps {
  settings: ReaderSettings;
  article: Article | null;
  detectedLanguage: LanguageCode;
  error: string | null;
}
