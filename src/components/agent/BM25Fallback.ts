/**
 * BM25 Fallback Implementation
 * Provides text search functionality when embeddings are unavailable
 * Ensures the system works without API keys
 */

import { SentenceAnchor } from './types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('bm25-fallback');

export class BM25Fallback {
  private documents: Array<{
    id: string;
    text: string;
    tokens: string[];
    length: number;
  }> = [];
  
  private avgDocLength = 0;
  private totalDocs = 0;
  private termFreq: Map<string, number> = new Map();
  
  // BM25 parameters
  private k1 = 1.2;
  private b = 0.75;

  /**
   * Add documents to the index
   */
  addDocuments(anchors: SentenceAnchor[]): void {
    this.documents = anchors.map(anchor => ({
      id: anchor.id,
      text: anchor.text,
      tokens: this.tokenize(anchor.text),
      length: anchor.text.length
    }));
    
    this.totalDocs = this.documents.length;
    this.avgDocLength = this.documents.reduce((sum, doc) => sum + doc.length, 0) / this.totalDocs;
    
    // Calculate term frequencies
    this.calculateTermFrequencies();
    
    logger.info(`Indexed ${this.totalDocs} documents with BM25`);
  }

  /**
   * Search for relevant documents
   */
  search(query: string, limit: number = 5): Array<{ id: string; score: number; text: string }> {
    const queryTokens = this.tokenize(query);
    const results: Array<{ id: string; score: number; text: string }> = [];
    
    this.documents.forEach(doc => {
      const score = this.calculateBM25Score(doc, queryTokens);
      if (score > 0) {
        results.push({
          id: doc.id,
          score,
          text: doc.text
        });
      }
    });
    
    // Sort by score and limit results
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Tokenize text into terms
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2) // Filter out short tokens
      .filter(token => !this.isStopWord(token));
  }

  /**
   * Check if token is a stop word
   */
  private isStopWord(token: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
    ]);
    
    return stopWords.has(token);
  }

  /**
   * Calculate term frequencies across all documents
   */
  private calculateTermFrequencies(): void {
    this.termFreq.clear();
    
    this.documents.forEach(doc => {
      const uniqueTokens = new Set(doc.tokens);
      uniqueTokens.forEach(token => {
        this.termFreq.set(token, (this.termFreq.get(token) || 0) + 1);
      });
    });
  }

  /**
   * Calculate BM25 score for a document
   */
  private calculateBM25Score(doc: { id: string; text: string; tokens: string[]; length: number }, queryTokens: string[]): number {
    let score = 0;
    
    queryTokens.forEach(queryToken => {
      const tf = this.getTermFrequency(doc.tokens, queryToken);
      const idf = this.getInverseDocumentFrequency(queryToken);
      
      const numerator = tf * (this.k1 + 1);
      const denominator = tf + this.k1 * (1 - this.b + this.b * (doc.length / this.avgDocLength));
      
      score += idf * (numerator / denominator);
    });
    
    return score;
  }

  /**
   * Get term frequency in a document
   */
  private getTermFrequency(docTokens: string[], term: string): number {
    return docTokens.filter(token => token === term).length;
  }

  /**
   * Get inverse document frequency for a term
   */
  private getInverseDocumentFrequency(term: string): number {
    const docFreq = this.termFreq.get(term) || 0;
    if (docFreq === 0) return 0;
    
    return Math.log((this.totalDocs - docFreq + 0.5) / (docFreq + 0.5));
  }

  /**
   * Get document by ID
   */
  getDocument(id: string): { id: string; text: string; tokens: string[]; length: number } | undefined {
    return this.documents.find(doc => doc.id === id);
  }

  /**
   * Get all documents
   */
  getAllDocuments(): Array<{ id: string; text: string; tokens: string[]; length: number }> {
    return [...this.documents];
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.documents = [];
    this.termFreq.clear();
    this.avgDocLength = 0;
    this.totalDocs = 0;
  }

  /**
   * Get index statistics
   */
  getStats(): {
    totalDocs: number;
    avgDocLength: number;
    uniqueTerms: number;
  } {
    return {
      totalDocs: this.totalDocs,
      avgDocLength: this.avgDocLength,
      uniqueTerms: this.termFreq.size
    };
  }
}