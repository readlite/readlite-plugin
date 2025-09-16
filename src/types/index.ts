/**
 * Central type definitions for ReadLite extension
 * Consolidates commonly used types to reduce duplication
 */

// Re-export all types from individual type files
export * from './reader';
export * from './agent';
export * from './api';
export * from './chat';
export * from './highlights';

// Common message types for Chrome extension communication
export interface ChromeMessage<T = any> {
  type: string;
  data?: T;
  error?: string;
  timestamp?: number;
}

// Reader mode messages
export interface ReaderModeMessage extends ChromeMessage {
  type: 'READER_MODE_CHANGED' | 'TOGGLE_READER' | 'ACTIVATE_READER' | 'DEACTIVATE_READER';
  isActive?: boolean;
}

// Content script messages
export interface ContentScriptMessage extends ChromeMessage {
  type: 'CONTENT_SCRIPT_READY';
}

// LLM API messages
export interface LLMStreamMessage extends ChromeMessage {
  type: 'LLM_STREAM_REQUEST' | 'LLM_STREAM_CHUNK' | 'LLM_STREAM_COMPLETE' | 'LLM_STREAM_ERROR';
  streamId?: string;
  chunk?: string;
}

export interface LLMApiMessage extends ChromeMessage {
  type: 'LLM_API_REQUEST';
  method: string;
  params: any[];
}

// Authentication messages
export interface AuthMessage extends ChromeMessage {
  type: 'AUTH_STATUS_CHANGED';
  isAuthenticated: boolean;
}

// Models request message
export interface ModelsMessage extends ChromeMessage {
  type: 'GET_MODELS_REQUEST';
  forceRefresh?: boolean;
}

// Union of all message types
export type ExtensionMessage = 
  | ReaderModeMessage 
  | ContentScriptMessage 
  | LLMStreamMessage 
  | LLMApiMessage 
  | AuthMessage 
  | ModelsMessage;

// Common component props
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

// Settings related types
export interface Settings {
  theme: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  width: number;
  spacing: 'tight' | 'normal' | 'relaxed';
  textAlign: 'left' | 'justify' | 'right' | 'center';
}

// Article data (consolidated from multiple definitions)
export interface Article {
  title?: string;
  content?: string;
  textContent?: string;
  byline?: string;
  author?: string;
  date?: string;
  siteName?: string;
  excerpt?: string;
  length?: number;
  dir?: string;
  language?: string;
  url?: string;
}

// Selection and highlight types
export interface Selection {
  text: string;
  range?: Range;
  position?: DOMRect;
}

export interface HighlightData {
  id: string;
  text: string;
  color?: string;
  note?: string;
  position: number;
  createdAt: number;
}

// Export utility type helpers
export type Optional<T> = T | undefined;
export type Nullable<T> = T | null;
export type AsyncFunction<T = void> = () => Promise<T>;
export type Callback<T = void> = (data: T) => void;