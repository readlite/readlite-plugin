/**
 * API related type definitions
 */

// Model interface for LLM models
export interface Model { 
  value: string; 
  label: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
} 