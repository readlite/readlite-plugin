import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { useI18n } from './I18nContext';
import llmClient from '../services/llmClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('translation-context');

interface TranslationContextType {
  isTranslating: boolean;
  translationProgress: number;
  translatedElements: Map<string, string>;
  
  translateElement: (element: HTMLElement) => Promise<void>;
  findAndTranslateContent: (containerElement: HTMLElement, text: string) => Promise<void>;
  translateArticle: (containerElement: HTMLElement) => Promise<void>;
  
  cancelTranslation: () => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

interface TranslationProviderProps {
  children: ReactNode;
}

/**
 * Translation Provider component
 */
export const TranslationProvider: React.FC<TranslationProviderProps> = ({ children }) => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [translatedElements, setTranslatedElements] = useState<Map<string, string>>(new Map());
  
  const translationQueue = useRef<HTMLElement[]>([]);
  const isTranslationCancelled = useRef(false);
  
  const translationCache = useRef<Map<string, string>>(new Map());
  
  const { t } = useI18n();
  
  const contentSelector = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption, td, th, caption, div.content-text, pre, pre > code';
  
  const cancelTranslation = useCallback(() => {
    isTranslationCancelled.current = true;
    translationQueue.current = [];
    setIsTranslating(false);
    setTranslationProgress(0);
    logger.info('Translation cancelled');
  }, []);
  
  const translateElement = useCallback(async (element: HTMLElement): Promise<void> => {
    if (!element || !element.textContent?.trim() || element.classList.contains('readlite-translating')) {
      return;
    }

    const tagName = element.tagName.toLowerCase();
    if (!element.getAttribute('data-content-id')) {
      const newId = `${tagName}-${Math.random().toString(36).substring(2, 9)}`;
      element.setAttribute('data-content-id', newId);
    }
    const elementId = element.getAttribute('data-content-id');
    
    // Check if already translated
    const existingTranslation = element.querySelector('.readlite-translation');
    if (existingTranslation) {
      return;
    }
    
    // Check translation cache
    if (translatedElements.has(elementId || '')) {
      // Has translation but not shown, add directly to element
      if (!existingTranslation) {
        const originalHTML = element.innerHTML;
        const translatedText = translatedElements.get(elementId || '') || '';
        
        element.innerHTML = `
          <div class="readlite-original-text">${originalHTML}</div>
          <div class="readlite-translation" 
            data-for-content="${elementId}"
            data-i18n-translation="${t('translation')}">
            ${translatedText}
          </div>
        `;
      }
      return;
    }
    
    const originalText = element.textContent.trim();
    if (originalText.length < 2) {
      return;
    }
    
    // Save original content
    const originalHTML = element.innerHTML;
    
    // Create translating state
    element.classList.add('readlite-translating');
    
    // Update element with original content and translation area
    element.innerHTML = `
      <div class="readlite-original-text">${originalHTML}</div>
      <div class="readlite-translation readlite-translating-indicator" 
        data-for-content="${elementId}"
        data-i18n-translating="${t('translating')}">
        ${t('translating')}...
      </div>
    `;
    
    // Get newly created translation element
    const translationDiv = element.querySelector('.readlite-translation') as HTMLElement;
    
    try {
      // Check cache first
      const cacheKey = originalText.substring(0, Math.min(100, originalText.length));
      let translatedText = translationCache.current.get(cacheKey);
      
      if (!translatedText) {
        // Determine target language
        const isChinese = /[\u4e00-\u9fa5]/.test(originalText);
        const targetLang = isChinese ? 'English' : 'Chinese';
        
        // Create translation prompt
        const prompt = `You are a professional translator. Translate the following text to ${targetLang}. Keep the original formatting and style. Only return the translated text without any explanations or notes:\n\n${originalText}`;
        
        // Use streaming API for better UX
        let streamedText = '';
        
        // Process streaming text chunks
        const handleStreamChunk = (chunk: string) => {
          streamedText += chunk;
          
          // Update translation area in real-time
          if (translationDiv && !isTranslationCancelled.current) {
            translationDiv.innerHTML = streamedText || t('translating') + '...';
          }
        };
        
        // Call translation API
        await llmClient.generateTextStream(prompt, handleStreamChunk, {
          model: 'google/gemini-2.0-flash-001',
          temperature: 0.5,
          maxTokens: 2000,
          enableMem0: false,
        });
        
        // Use streamed text as translation result
        translatedText = streamedText;
        if (!translatedText) {
          translatedText = t('translationFailed');
        }
        
        // Cache results
        if (translatedText) {
          translationCache.current.set(cacheKey, translatedText);
        }
      }
      
      // Store translated content for future use
      setTranslatedElements(prev => {
        const updated = new Map(prev);
        updated.set(elementId || '', translatedText);
        return updated;
      });
      
      // Update translation area
      if (translationDiv && !isTranslationCancelled.current) {
        translationDiv.innerHTML = translatedText;
        translationDiv.classList.remove('readlite-translating-indicator');
      }
    } catch (error) {
      logger.error(`Translation error: ${error instanceof Error ? error.message : String(error)}`);
      
      // Show error state
      if (translationDiv) {
        translationDiv.innerHTML = t('translationFailed');
        translationDiv.setAttribute('data-i18n-error', t('translationError'));
        translationDiv.classList.add('readlite-translation-error');
        translationDiv.style.color = 'var(--readlite-error)';
      }
    } finally {
      element.classList.remove('readlite-translating');
    }
  }, [t, translatedElements]);
  
  /**
   * Find and translate elements containing the specified text
   */
  const findAndTranslateContent = useCallback(async (containerElement: HTMLElement, text: string): Promise<void> => {
    if (!containerElement) return;
    
    // Get all content elements
    const allContentElements = Array.from(
      containerElement.querySelectorAll(contentSelector)
    ) as HTMLElement[];
    
    const elementsToTranslate: HTMLElement[] = [];
    
    // Find elements containing the text
    for (const element of allContentElements) {
      if (element.textContent?.includes(text)) {
        elementsToTranslate.push(element);
      }
    }
    
    // If no exact matches, try partial matching
    if (elementsToTranslate.length === 0 && text.length > 20) {
      const chunks = [];
      const chunkSize = 15;
      
      for (let i = 0; i < text.length - chunkSize; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize * 2));
      }
      
      const found = new Set<HTMLElement>();
      for (const chunk of chunks) {
        if (chunk.trim().length < 10) continue;
        
        for (const element of allContentElements) {
          if (element.textContent?.includes(chunk) && !found.has(element)) {
            found.add(element);
            elementsToTranslate.push(element);
          }
        }
      }
    }
    
    // Translate found elements
    if (elementsToTranslate.length > 0) {
      setIsTranslating(true);
      
      // Sort elements by DOM order
      elementsToTranslate.sort((a, b) => {
        const aIndex = allContentElements.indexOf(a);
        const bIndex = allContentElements.indexOf(b);
        return aIndex - bIndex;
      });
      
      // Remove duplicates
      const uniqueElements = [...new Set(elementsToTranslate)];
      
      try {
        // Translate each element in sequence
        for (const element of uniqueElements) {
          if (isTranslationCancelled.current) {
            break;
          }
          await translateElement(element);
        }
      } finally {
        setIsTranslating(false);
      }
    }
  }, [contentSelector, translateElement]);
  
  /**
   * Process translation in batches
   */
  const processTranslationBatch = useCallback(async () => {
    if (isTranslationCancelled.current) {
      translationQueue.current = [];
      setIsTranslating(false);
      return;
    }
    
    // Get next batch of elements (process 5 at a time to avoid excessive token usage)
    const batchSize = 5;
    const currentBatch = translationQueue.current.splice(0, batchSize);
    
    if (!currentBatch || currentBatch.length === 0) {
      // All completed
      setIsTranslating(false);
      setTranslationProgress(100);
      logger.info('Article translation completed');
      return;
    }
    
    // Calculate total elements and progress
    const totalElements = currentBatch.length + translationQueue.current.length;
    const completedElements = 0;
    const newProgress = Math.round((completedElements / totalElements) * 100);
    setTranslationProgress(newProgress);
    
    try {
      // Create a set of parallel translation promises
      const translationPromises = currentBatch.map(element => {
        if (!element || isTranslationCancelled.current) {
          return Promise.resolve();
        }
        
        return translateElement(element)
          .catch(error => {
            logger.error('Batch translation element error:', error);
            // Resolve anyway to continue with other elements
            return Promise.resolve();
          });
      });
      
      // Wait for all translations to complete
      await Promise.all(translationPromises);
      
      // Update progress after batch completion
      const progressNow = Math.min(99, Math.round(((totalElements - translationQueue.current.length) / totalElements) * 100));
      setTranslationProgress(progressNow);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      logger.error('Batch translation error:', error);
    }
    
    // Process next batch if there are still elements
    if (!isTranslationCancelled.current && translationQueue.current.length > 0) {
      setTimeout(() => processTranslationBatch(), 100);
    } else {
      // All batches completed
      setIsTranslating(false);
      setTranslationProgress(100);
      logger.info('Article translation completed');
    }
  }, [translateElement]);
  
  /**
   * Translate the entire article
   */
  const translateArticle = useCallback(async (containerElement: HTMLElement): Promise<void> => {
    if (isTranslating) {
      // Cancel if already translating
      cancelTranslation();
      return;
    }

    try {
      // Reset state
      setIsTranslating(true);
      setTranslationProgress(0);
      isTranslationCancelled.current = false;
      
      if (!containerElement) {
        logger.error('Article content element not found');
        setIsTranslating(false);
        return;
      }
      
      // Select all translatable text elements
      const elements = Array.from(containerElement.querySelectorAll(contentSelector)) as HTMLElement[];
      
      // Filter out already translated or empty elements
      const translatableElements = elements.filter(el => {
        // Skip already translated elements
        if (el.querySelector('.readlite-translation')) {
          return false;
        }
        // Skip elements with meaningless content
        const content = el.textContent;
        return content != null && content.trim().length > 1;
      });
      
      if (translatableElements.length === 0) {
        logger.info('No elements to translate');
        setIsTranslating(false);
        return;
      }
      
      // Store elements in queue
      translationQueue.current = translatableElements;
      
      // Start batch translation
      processTranslationBatch();
    } catch (error) {
      logger.error('Error starting article translation:', error);
      setIsTranslating(false);
    }
  }, [isTranslating, contentSelector, processTranslationBatch, cancelTranslation]);

  const contextValue: TranslationContextType = {
    isTranslating,
    translationProgress,
    translatedElements,
    translateElement,
    findAndTranslateContent, 
    translateArticle,
    cancelTranslation
  };
  
  return (
    <TranslationContext.Provider value={contextValue}>
      {children}
    </TranslationContext.Provider>
  );
};

/**
 * Hook for using the translation context
 */
export const useTranslation = (): TranslationContextType => {
  const context = useContext(TranslationContext);
  
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  
  return context;
}; 