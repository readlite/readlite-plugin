import { useState, useEffect, useCallback } from 'react';
import { Model } from '../../../types/api';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('useAgentModels');

export const useAgentModels = (isAuth: boolean) => {
  const [modelsList, setModelsList] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);

  // Load saved model from localStorage
  useEffect(() => {
    try {
      const savedModelId = localStorage.getItem('readlite_selected_model');
      if (savedModelId && modelsList.length > 0) {
        const matchedModel = modelsList.find(model => model.value === savedModelId);
        if (matchedModel) {
          logger.info(`Loaded saved model from localStorage: ${savedModelId}`);
          setSelectedModel(matchedModel);
        }
      }
    } catch (error) {
      logger.error('Error loading saved model:', error);
    }
  }, [modelsList]); // Run when modelsList is populated

  // Fetch available models
  const loadModels = useCallback((attempt = 1, maxAttempts = 3, delay = 2000, forceRefresh = false) => {
    logger.info(`Loading models (attempt ${attempt}/${maxAttempts})`);
    
    chrome.runtime.sendMessage({ 
      type: 'GET_MODELS_REQUEST',
      forceRefresh: forceRefresh || attempt > 1
    }, (response) => {
      if (chrome.runtime.lastError) {
        logger.error("Error requesting models:", chrome.runtime.lastError);
        retryIfNeeded(attempt, maxAttempts, delay, forceRefresh);
        return;
      }
      
      if (response && response.success && Array.isArray(response.data)) {
        logger.info(`Received models list (${response.data.length} models, fromCache: ${response.fromCache})`);
        
        if (response.data.length === 0 && isAuth && attempt < maxAttempts) {
          logger.info(`Empty models list while authenticated, will retry in ${delay}ms`);
          retryIfNeeded(attempt, maxAttempts, delay, forceRefresh);
          return;
        }
        
        setModelsList(response.data);
        
        // Set default model if none selected or selected not found
        if (response.data.length > 0) {
            const savedModelId = localStorage.getItem('readlite_selected_model');
            const currentSelectedAvailable = savedModelId && response.data.some((m: Model) => m.value === savedModelId);
            
            if (!currentSelectedAvailable) {
                const defaultModel = response.data[0];
                logger.info(`Selected model not found or not set, using default: ${defaultModel.label}`);
                setSelectedModel(defaultModel);
                localStorage.setItem('readlite_selected_model', defaultModel.value);
            }
        } else {
            logger.warn('No models available from API');
            setSelectedModel(null);
        }
      } else {
        logger.error("Failed to get models from background or invalid format:", response);
        retryIfNeeded(attempt, maxAttempts, delay, forceRefresh);
      }
    });
  }, [isAuth]);

  const retryIfNeeded = (attempt: number, maxAttempts: number, delay: number, forceRefresh: boolean) => {
    if (attempt < maxAttempts) {
      setTimeout(() => {
        loadModels(attempt + 1, maxAttempts, delay, forceRefresh);
      }, delay);
    }
  };

  // Initial load
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Handle selection change
  const handleSetSelectedModel = useCallback((model: Model | null) => {
    setSelectedModel(model);
    if (model) {
      try {
        localStorage.setItem('readlite_selected_model', model.value);
        logger.info(`Saved selected model to localStorage: ${model.label}`);
      } catch (error) {
        logger.error('Error saving model to localStorage:', error);
      }
    }
  }, []);

  return {
    modelsList,
    selectedModel,
    setSelectedModel: handleSetSelectedModel,
    refreshModels: (force = false) => loadModels(1, 3, 2000, force)
  };
};
