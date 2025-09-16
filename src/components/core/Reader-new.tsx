/**
 * Simplified Reader Component
 * Main entry point for the reader mode UI
 */

import React, { useEffect } from 'react';
import { ReaderContainer } from '../reader/ReaderContainer';
import { useApp } from '../../context/AppContext';
import { createLogger } from '../../utils/logger';
import { parseArticle } from '../../utils/parser';

const logger = createLogger('reader');

export const Reader: React.FC = () => {
  const { state, actions } = useApp();

  // Load article on mount if not already loaded
  useEffect(() => {
    if (!state.article && !state.isLoading && !state.error) {
      loadArticleContent();
    }
  }, []);

  // Parse and load article content
  const loadArticleContent = async () => {
    logger.info('Loading article content');
    actions.setLoading(true);

    try {
      // Parse the current page
      const article = await parseArticle();
      
      if (!article || !article.content) {
        throw new Error('Unable to extract article content from this page');
      }

      logger.info('Article parsed successfully', {
        title: article.title,
        length: article.textContent?.length || 0
      });

      actions.setArticle(article);
    } catch (error) {
      logger.error('Failed to load article:', error);
      actions.setError(
        error instanceof Error ? error.message : 'Failed to load article content'
      );
    } finally {
      actions.setLoading(false);
    }
  };

  return <ReaderContainer />;
};

export default Reader;