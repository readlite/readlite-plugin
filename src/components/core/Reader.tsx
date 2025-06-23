import React, { useState, useEffect, useRef, useCallback } from "react"
import { useReader } from "../../context/ReaderContext"
import Settings from "../settings/Settings"
import { useI18n } from "../../context/I18nContext"
import { useTranslation } from "../../context/TranslationContext"
import { LanguageCode } from "../../utils/language"
import { exportAsMarkdown } from "../../utils/export"
import { AgentUI } from "../agent/AgentUI"
import ReaderToolbar from "../reader/ReaderToolbar"
import ReaderContent from "../reader/ReaderContent"
import ReaderDivider from "../reader/ReaderDivider"
import { ThemeProvider } from "../../context/ThemeContext"
import { ThemeType } from "../../config/theme"
import { createLogger } from "../../utils/logger"
import SelectionToolbar from "../reader/SelectionToolbar"
import { HighlightColor } from "../../hooks/useTextSelection"
import { BookOpenIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { LanguageIcon } from '@heroicons/react/24/outline';
import llmClient from '../../utils/llmClient';
import { isAuthenticated } from '../../utils/auth';

// Create a logger for this module
const logger = createLogger('main-reader');

// Virtual highlight element type for selection handling
interface VirtualHighlightElement {
  getAttribute(name: string): string | null;
  hasAttribute?(name: string): boolean;
}

/**
 * Reading Progress Indicator Component
 * Shows a progress bar at the top of the reader
 */
const ReadingProgress: React.FC<{ scrollContainer?: HTMLElement | null }> = ({ scrollContainer }) => {
  const [progress, setProgress] = useState(0);
  
  // Update progress as user scrolls
  useEffect(() => {
    if (!scrollContainer) return;
    
    const handleScroll = () => {
      const scrollPosition = scrollContainer.scrollTop;
      const containerHeight = scrollContainer.clientHeight;
      const scrollHeight = scrollContainer.scrollHeight - containerHeight;
      
      if (scrollHeight <= 0) return;
      
      const currentProgress = Math.min(100, Math.max(0, (scrollPosition / scrollHeight) * 100));
      setProgress(currentProgress);
    };
    
    handleScroll();
    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [scrollContainer]);
  
  return (
    <div className="fixed top-0 left-0 w-full h-1.5 z-[9999] bg-accent/20 pointer-events-none">
      <div 
        className={`h-full transition-all duration-150 ease-out bg-accent`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

/**
 * Main Reader component
 * Displays the article in a clean, readable format with a side-by-side AI assistant.
 */
const Reader = () => {
  // Get reader state from context
  const {
    article,
    settings,
    isLoading,
    error,
    updateSettings,
    closeReader,
    loadArticle
  } = useReader();

  // Additional state for reader functionality
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [visibleContent, setVisibleContent] = useState<string>("");
  const [iframeReady, setIframeReady] = useState(false);

  // State for Reader UI
  const [showSettings, setShowSettings] = useState(false)
  const [showAgent, setShowAgent] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(65) // Default to 65% width for reader
  const readerContentRef = useRef<HTMLDivElement>(null)
  const dividerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const initialXRef = useRef(0)
  const initialWidthRef = useRef(0)
  const settingsButtonRef = useRef<HTMLButtonElement>(null) as React.RefObject<HTMLButtonElement>
  const [detectedLanguage, setDetectedLanguage] = useState<LanguageCode>('en')
  
  // Get translations function
  const { t } = useI18n()
  
  // Reference to main reader column for scroll tracking
  const readerColumnRef = useRef<HTMLDivElement>(null);
  
  // Reference to shadowRoot created by StyleIsolator
  const readerContainerRef = useRef<HTMLDivElement>(null);
  
  // Extract current theme from settings for use with ThemeProvider
  const theme = settings.theme as ThemeType;
  
  // Text selection state
  const [selectionState, setSelectionState] = useState<{
    isActive: boolean;
    rect: DOMRect | null;
    highlightElement?: Element | VirtualHighlightElement | null;
    selectedText?: string;
    domPath?: {
      startPath: number[];
      endPath: number[];
      startOffset: number;
      endOffset: number;
    } | null;
  }>({
    isActive: false,
    rect: null,
    highlightElement: null,
    selectedText: '',
    domPath: null
  });

  // Track scroll position for progress bar
  const [scrollProgress, setScrollProgress] = useState(0);
  
  // Track last removed highlight timestamp to prevent duplicates
  const lastRemoveHighlightRef = useRef(0);

  // Auto-scroll state
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const autoScrollIntervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(1.5); // Speed in pixels per frame (default: normal reading speed)

  // Translation state
  const [translationState, setTranslationState] = useState<{
    isVisible: boolean;
    originalText: string;
    translatedText: string;
    position: { x: number; y: number };
  }>({
    isVisible: false,
    originalText: '',
    translatedText: '',
    position: { x: 0, y: 0 }
  });

  // Get translation functions from context
  const { translateArticle: translateWithContext, isTranslating: isTranslationActive, translationProgress: translationProgressValue, findAndTranslateContent } = useTranslation();

  // --- Lifecycle Effects ---

  // Log when Reader component mounts and check for iframe
  useEffect(() => {
    logger.info("Reader component mounted");
    
    const iframe = window.parent.document.getElementById("readlite-iframe-container") as HTMLIFrameElement;
    if (iframe) {
      logger.info("Reader iframe found");
      setIframeReady(true);
    } else {
      logger.warn("Reader iframe not found on component mount");
      
      const checkInterval = setInterval(() => {
        const checkIframe = window.parent.document.getElementById("readlite-iframe-container");
        if (checkIframe) {
          logger.info("Reader iframe detected");
          setIframeReady(true);
          clearInterval(checkInterval);
        }
      }, 500);
      
      return () => clearInterval(checkInterval);
    }
  }, []);

  // Load article data when component mounts and iframe is ready
  useEffect(() => {
    if (iframeReady) {
      logger.info("Iframe ready, loading article content");
      loadArticle();
    }
  }, [iframeReady, loadArticle]);

  // --- Selection and Highlighting Handlers ---

  // Listen for text selection messages from ReaderContent
  useEffect(() => {
    let lastProcessedTimestamp = 0;
    
    const handleSelectionMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'TEXT_SELECTED') {
        const now = Date.now();
        if (now - lastProcessedTimestamp < 50) return;
        
        lastProcessedTimestamp = now;
        
        let rect = event.data.rect;
        
        if (rect) {
          if (isFullscreen) {
            rect = {
              ...rect,
              left: isFinite(rect.left) ? rect.left : 0,
              top: isFinite(rect.top) ? rect.top : 0,
              right: isFinite(rect.right) ? rect.right : 0,
              bottom: isFinite(rect.bottom) ? rect.bottom : 0,
              width: isFinite(rect.width) ? rect.width : 0,
              height: isFinite(rect.height) ? rect.height : 0
            };
          }
          
          if (rect.width > 0 && rect.height > 0) {
            let highlightElement = null;
            
            if (event.data.highlightData) {
              highlightElement = {
                getAttribute: (attr: string) => {
                  if (attr === 'data-highlight-id') return event.data.highlightData.id;
                  if (attr === 'data-highlight-color') return event.data.highlightData.color;
                  return null;
                }
              };
            }
            
            setSelectionState({
              isActive: event.data.isActive,
              rect: rect,
              highlightElement: highlightElement,
              selectedText: event.data.selectedText || '',
              domPath: event.data.domPath
            });
          }
        } else if (event.data && event.data.type === 'TRANSLATE_SELECTION_COMPLETE') {
          if (event.data.success && event.data.selectedText) {
            // Get the selection position for the popup
            const selection = window.getSelection();
            if (!selection || !selection.rangeCount) return;
            
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            // Show loading state
            setTranslationState({
              isVisible: true,
              originalText: event.data.selectedText,
              translatedText: '翻译中...',
              position: {
                x: rect.left + rect.width / 2,
                y: rect.top
              }
            });

            // Call Gemini Flash 1.5 for translation using streaming
            const prompt = `Translate the following text to ${event.data.selectedText.match(/[\u4e00-\u9fa5]/) ? 'English' : 'Chinese'}. Keep the original formatting and style. Only return the translated text without any explanations or notes:\n\n${event.data.selectedText}`;

            // Use streaming instead of direct call
            let streamedTranslation = '';
            
            // Stream handler to process each chunk
            const handleStreamChunk = (chunk: string) => {
              streamedTranslation += chunk;
              // Update UI with the accumulated translation so far
              setTranslationState(prev => ({
                ...prev,
                translatedText: streamedTranslation.trim() || '翻译中...'
              }));
            };
            
            llmClient.generateTextStream(prompt, handleStreamChunk, {
              model: 'google/gemini-flash-1.5-8b',
              temperature: 0.4,
              maxTokens: 100000,
              enableMem0: false,
            }).then(fullTranslation => {
              // Final update with complete translation
              setTranslationState(prev => ({
                ...prev,
                translatedText: (fullTranslation as string).trim()
              }));
            }).catch(error => {
              logger.error('Translation error:', error);
              setTranslationState(prev => ({
                ...prev,
                translatedText: '翻译失败，请重试'
              }));
            });
          }
        }
      }
    };

    window.addEventListener('message', handleSelectionMessage);
    return () => {
      window.removeEventListener('message', handleSelectionMessage);
    };
  }, [isFullscreen]);

  // Handle copying selected text
  const handleCopy = useCallback(async () => {
    try {
      // Send message directly to window with the selected text
      window.postMessage(
        { 
          type: 'COPY_SELECTION',
          selectedText: selectionState.selectedText
        },
        '*'
      );
      
      // Log success
      logger.info('Copy selection message sent');
    } catch (error) {
      logger.error('Error copying text:', error);
    }
  }, [selectionState.selectedText]);
  
  // Listen for copy operation completion
  useEffect(() => {
    const handleCopyComplete = (event: MessageEvent) => {
      if (event.data && event.data.type === 'COPY_SELECTION_COMPLETE') {
        if (event.data.success) {
          logger.info('Copy operation completed successfully');
          // You could show a UI notification here if desired
        } else {
          const errorMsg = event.data.error || 'Unknown error';
          logger.warn('Copy operation failed:', errorMsg);
          // You could show an error notification here if desired
        }
      }
    };
    
    window.addEventListener('message', handleCopyComplete);
    return () => {
      window.removeEventListener('message', handleCopyComplete);
    };
  }, []);

  // Handle removing a highlight
  const handleRemoveHighlight = useCallback((element: Element | VirtualHighlightElement) => {
    try {
      const now = Date.now();
      if (now - lastRemoveHighlightRef.current < 100) return;
      lastRemoveHighlightRef.current = now;
      
      if (!element) {
        logger.error('Cannot remove highlight: Invalid element');
        return;
      }
      
      const highlightId = element.getAttribute('data-highlight-id');
      if (!highlightId) {
        logger.error('Cannot remove highlight: Missing highlight ID');
        return;
      }

      // Send message directly to window
      window.postMessage({ 
        type: 'REMOVE_HIGHLIGHT', 
        highlightId: highlightId
      }, '*');
      
      // Keep selectedText in state but clear other properties
      setSelectionState(prev => ({ 
        ...prev, 
        isActive: false, 
        rect: null, 
        highlightElement: null 
      }));
    } catch (err) {
      logger.error('Error in handleRemoveHighlight:', err);
      // Keep selectedText in state but clear other properties
      setSelectionState(prev => ({ 
        ...prev, 
        isActive: false, 
        rect: null, 
        highlightElement: null 
      }));
    }
  }, []);

  // Handle text highlight
  const handleHighlight = useCallback((color: HighlightColor) => {
    try {
      // Send message directly to window
      window.postMessage({ type: 'HIGHLIGHT_TEXT', color }, '*');
    } catch (err) {
      logger.error('Error in handleHighlight:', err);
      // Keep selectedText in state but clear other properties
      setSelectionState(prev => ({ 
        ...prev, 
        isActive: false, 
        rect: null, 
        highlightElement: null 
      }));
    }
  }, []);

  // Handle asking AI with selected text
  const handleAskAI = useCallback((selectedText: string) => {
    try {
      // Use the actual selectedText from state rather than the parameter
      const textToProcess = selectionState.selectedText || selectedText;
      
      if (textToProcess && textToProcess.trim()) {
        if (!showAgent) {
          setShowAgent(true);
        }
        
        window.postMessage({
          type: 'ASK_AI_WITH_SELECTION',
          selectedText: textToProcess.trim()
        }, '*');
        
        setSelectionState(prev => ({ ...prev, isActive: false }));
      } else {
        logger.warn('No text selected for AI processing');
      }
    } catch (err) {
      logger.error('Error in handleAskAI:', err);
      setSelectionState(prev => ({ ...prev, isActive: false }));
    }
  }, [showAgent, setShowAgent, selectionState.selectedText]);

  // Handle direct DOM selection in fullscreen mode
  const captureSelection = useCallback(() => {
    if (!isFullscreen) return;
    
    try {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        if (rect && isFinite(rect.width) && isFinite(rect.height) && 
            rect.width > 0 && rect.height > 0) {
          setSelectionState({
            isActive: true,
            rect: rect,
            highlightElement: null,
            selectedText: ''
          });
        }
      }
    } catch (err) {
      logger.error('Error capturing selection:', err);
    }
  }, [isFullscreen, setSelectionState]);

  // Handle text selection events
  const handleTextSelection = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isFullscreen) {
      setTimeout(() => {
        captureSelection();
      }, 0);
    }
  }, [isFullscreen, captureSelection]);

  // --- Fullscreen Effects ---

  // Monitor fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Ensure text selection in fullscreen mode
  useEffect(() => {
    if (isFullscreen && readerContainerRef.current) {
      setTimeout(() => {
        if (readerContainerRef.current) {
          readerContainerRef.current.style.userSelect = 'text'; 
          readerContainerRef.current.style.webkitUserSelect = 'text';
        }
        if (readerContentRef.current) {
          readerContentRef.current.style.userSelect = 'text';
          readerContentRef.current.style.webkitUserSelect = 'text';
        }
        
        document.body.style.userSelect = 'text';
        document.body.style.webkitUserSelect = 'text';
      }, 100);
    }
  }, [isFullscreen]);
  
  // Special handling for text selection in fullscreen mode
  useEffect(() => {
    if (!isFullscreen) return;

    const style = document.createElement('style');
    style.id = 'fullscreen-selection-style';
    style.textContent = `
      ::selection {
        background: rgba(0, 100, 255, 0.3) !important;
      }
      
      * {
        -webkit-user-select: text !important;
        user-select: text !important;
      }
      
      @media all {
        :fullscreen {
          -webkit-user-select: text !important;
          user-select: text !important;
        }
      }
      
      .readlite-selection-toolbar {
        position: fixed !important;
        z-index: 2147483647 !important;
        transform: translateZ(0) !important;
        pointer-events: auto !important;
      }
      
      .readlite-selection-toolbar button {
        pointer-events: auto !important;
      }
      
      :fullscreen .readlite-selection-toolbar {
        position: fixed !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
      }

      :root:fullscreen .readlite-selection-toolbar,
      :root:fullscreen ~ .readlite-selection-toolbar,
      :root:fullscreen > * .readlite-selection-toolbar {
        display: block !important;
      }
    `;
    document.head.appendChild(style);

    const handleFullscreenSelection = () => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          setSelectionState({
            isActive: true,
            rect: rect,
            highlightElement: null,
            selectedText: ''
          });
        }
      }
    };

    document.addEventListener('mouseup', handleFullscreenSelection);
    document.addEventListener('selectionchange', () => {
      setTimeout(handleFullscreenSelection, 10);
    });

    return () => {
      const styleEl = document.getElementById('fullscreen-selection-style');
      if (styleEl) {
        styleEl.remove();
      }
      document.removeEventListener('mouseup', handleFullscreenSelection);
      document.removeEventListener('selectionchange', handleFullscreenSelection);
    };
  }, [isFullscreen, setSelectionState]);
  
  // Load user preferences
  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem('readerPanelWidth');
      if (savedWidth) {
        setLeftPanelWidth(parseFloat(savedWidth));
      }
      
      const savedShowAI = localStorage.getItem('showAIPanel');
      if (savedShowAI) {
        setShowAgent(savedShowAI === 'true');
      }
    } catch (e) {
      logger.error(`Error loading preferences:`, e);
    }
  }, []);
  
  // Save user preferences
  useEffect(() => {
    if (isDraggingRef.current) return;
    try {
      localStorage.setItem('showAIPanel', showAgent.toString());
    } catch (e) {
      logger.error(`Error saving preferences:`, e);
    }
  }, [showAgent]);
  
  // Save panel width when it changes, but not during dragging
  useEffect(() => {
    if (isDraggingRef.current) return;
    try {
      localStorage.setItem('readerPanelWidth', leftPanelWidth.toString());
    } catch (e) {
      logger.error(`Error saving panel width:`, e);
    }
  }, [leftPanelWidth]);
  
  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && showAgent) {
        if (leftPanelWidth < 40) {
          setLeftPanelWidth(40);
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showAgent, leftPanelWidth]);
  
  // Extract visible content when scrolling or resizing
  useEffect(() => {
    if (!readerContentRef.current || !article) return;
    
    const readerContent = readerContentRef.current;
    const readerColumn = readerContent.parentElement;
    
    if (!readerColumn) return;
    
    let lastScrollTop = readerColumn.scrollTop;
    let lastProcessedTime = Date.now();
    let scrollCounter = 0;
    let forceUpdateCounter = 0;
    
    const extractVisibleContent = () => {
      const currentScrollTop = readerColumn.scrollTop;
      const scrollDelta = Math.abs(currentScrollTop - lastScrollTop);
      const timeDelta = Date.now() - lastProcessedTime;
      
      forceUpdateCounter++;
      const shouldForceUpdate = forceUpdateCounter >= 10;
      
      if (scrollDelta < 50 && timeDelta < 500 && !shouldForceUpdate) {
        return;
      }
      
      if (shouldForceUpdate) {
        forceUpdateCounter = 0;
      }
      
      scrollCounter++;
      lastScrollTop = currentScrollTop;
      lastProcessedTime = Date.now();
      
      const containerRect = readerContent.getBoundingClientRect();
      if (!containerRect) return;
      
      const textElements = readerContent.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
      
      if (!textElements || textElements.length === 0) {
        return;
      }
      
      const readerScrollTop = readerColumn.scrollTop;
      const readerViewportTop = 0;
      const readerViewportBottom = readerColumn.clientHeight;
      
      let visibleText = '';
      let visibleElementsCount = 0;
      let visibleElementsList = [];
      
      if (article.title) {
        visibleText += article.title + '\n\n';
      }
      
      textElements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const offsetTop = rect.top + readerScrollTop - containerRect.top;
        
        const elementTop = rect.top;
        const elementBottom = rect.bottom;
        const windowTop = 0;
        const windowBottom = window.innerHeight;
        
        const isVisibleSimple = 
          elementBottom > windowTop && 
          elementTop < windowBottom;
        
        const isVisible = isVisibleSimple || (
          offsetTop < readerViewportBottom &&
          offsetTop + rect.height > readerViewportTop &&
          rect.height > 0
        );
        
        if (isVisible) {
          visibleElementsCount++;
          let elementText = el.textContent?.trim() || '';
          
          if (elementText) {
            const tagName = el.tagName.toLowerCase();
            const shortPreview = elementText.substring(0, 30) + (elementText.length > 30 ? '...' : '');
            visibleElementsList.push(`${tagName}: ${shortPreview}`);
            
            if (tagName.startsWith('h')) {
              visibleText += elementText + '\n\n';
            } else if (tagName === 'li') {
              visibleText += '• ' + elementText + '\n';
            } else if (tagName === 'blockquote') {
              visibleText += '> ' + elementText + '\n\n';
            } else {
              visibleText += elementText + '\n\n';
            }
          }
        }
      });
      
      const contentHash = `${visibleElementsCount}-${visibleText.length}-${visibleText.substring(0, 50)}`;
      const currentContentHash = sessionStorage.getItem('lastVisibleContentHash') || '';
      
      if (contentHash !== currentContentHash || shouldForceUpdate) {
        sessionStorage.setItem('lastVisibleContentHash', contentHash);
        setVisibleContent(visibleText);
      }
    };
    
    extractVisibleContent();
    
    setTimeout(() => {
      forceUpdateCounter = 100;
      extractVisibleContent();
    }, 1000);
    
    const handleScroll = () => {
      requestAnimationFrame(extractVisibleContent);
    };
    
    readerColumn.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    
    return () => {
      readerColumn.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      sessionStorage.removeItem('lastVisibleContentHash');
    };
  }, [article]);
  
  // Direct scroll handler for progress bar
  useEffect(() => {
    if (!readerColumnRef.current) return;
    
    const scrollContainer = readerColumnRef.current;
    
    const handleDirectScroll = () => {
      const scrollPosition = scrollContainer.scrollTop;
      const containerHeight = scrollContainer.clientHeight;
      const scrollHeight = scrollContainer.scrollHeight - containerHeight;
      
      if (scrollHeight <= 0) return;
      
      const progress = Math.min(100, Math.max(0, (scrollPosition / scrollHeight) * 100));
      setScrollProgress(progress);
    };
    
    handleDirectScroll();
    
    scrollContainer.addEventListener('scroll', handleDirectScroll);
    return () => scrollContainer.removeEventListener('scroll', handleDirectScroll);
  }, [readerColumnRef.current]);
  
  // --- Drag Handlers ---
  
  // Start dragging the divider
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    initialXRef.current = e.clientX;
    initialWidthRef.current = leftPanelWidth;
    
    const eventTarget = e.target as HTMLElement;
    const targetDoc = eventTarget?.ownerDocument || document;
    
    targetDoc.addEventListener('mousemove', handleDrag, { capture: true });
    targetDoc.addEventListener('mouseup', handleDragEnd, { capture: true });
    
    targetDoc.body.style.cursor = 'col-resize';
    targetDoc.body.style.userSelect = 'none';
  };

  // Handle mouse movement during drag
  const handleDrag = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    
    requestAnimationFrame(() => {
      const containerElement = readerContainerRef.current;
      const containerWidth = containerElement?.clientWidth || window.innerWidth;
      
      const deltaX = e.clientX - initialXRef.current;
      const percentageDelta = (deltaX / containerWidth) * 100;
      
      let newWidth = Math.min(85, Math.max(30, initialWidthRef.current + percentageDelta));
      setLeftPanelWidth(newWidth);
    });
  }, []);

  // End dragging
  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    
    const docs = [document]; 
    
    try {
      const iframe = document.getElementById('readlite-iframe-container') as HTMLIFrameElement;
      if (iframe?.contentDocument) {
        docs.push(iframe.contentDocument);
      }
    } catch (e) {
      // Ignore errors accessing iframe document
    }
    
    docs.forEach(doc => {
      doc.removeEventListener('mousemove', handleDrag, { capture: true });
      doc.removeEventListener('mouseup', handleDragEnd, { capture: true });
      
      if (doc.body) {
        doc.body.style.cursor = '';
        doc.body.style.userSelect = '';
      }
    });
    
    if (document.fullscreenElement && readerContainerRef.current) {
      readerContainerRef.current.style.userSelect = 'text';
      if (readerContentRef.current) {
        readerContentRef.current.style.userSelect = 'text';
      }
    }
    
    try {
      localStorage.setItem('readerPanelWidth', leftPanelWidth.toString());
    } catch (e) {
      logger.error(`Error saving panel width after drag:`, e);
    }
  }, [handleDrag, leftPanelWidth]);
  
  // --- UI Animation Setup ---

  useEffect(() => {
    if (readerContainerRef.current) {
      const doc = readerContainerRef.current.ownerDocument || document;
      
      if (!doc.getElementById('readlite-animation-styles')) {
        try {
          const style = doc.createElement('style');
          style.id = 'readlite-animation-styles';
          style.textContent = `
            @keyframes fadeout {
              from { opacity: 1; }
              to { opacity: 0; }
            }
            
            .animate-fadeout {
              animation: fadeout 0.3s ease-out forwards;
            }
            
            @keyframes fadein {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            
            .animate-fadein {
              animation: fadein 0.3s ease-in forwards;
            }
          `;
          doc.head.appendChild(style);
        } catch (e) {
          logger.warn('Failed to add animation styles to reader document', e);
        }
      }
    }
  }, [readerContainerRef.current]);

  // --- Event Handlers ---

  /**
   * Toggles fullscreen mode for the reader
   */
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      readerContainerRef.current?.requestFullscreen().catch(err => {
        logger.error(`Error attempting to enable fullscreen:`, err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  /**
   * Toggles the visibility of the settings panel.
   */
  const toggleSettings = useCallback(() => {
    setShowSettings((prev: boolean) => !prev)
  }, [setShowSettings]);
  
  /**
   * Toggles the visibility of the AI side panel.
   */
  const toggleAgent = useCallback(() => {
    setShowAgent((prev: boolean) => !prev)
  }, [setShowAgent]);
  
  /**
   * Closes the reader view
   */
  const handleClose = useCallback(() => {
    chrome.runtime.sendMessage({
      type: "READER_MODE_CHANGED",
      isActive: false
    }).catch(error => logger.warn("Failed to send READER_MODE_CHANGED message:", error))
    
    document.dispatchEvent(new CustomEvent('READLITE_TOGGLE_INTERNAL'))
  }, []);

  /**
   * Handles the download of the article as Markdown.
   */
  const handleMarkdownDownload = useCallback(() => {
    if (article?.title && article.content) {
      try {
        exportAsMarkdown(article.title, article.content);
      } catch (error) {
        logger.error(`Export to Markdown failed:`, error);
      }
    }
  }, [article]);

  // --- Auto-scroll functionality ---

  // Toggle auto-scroll
  const toggleAutoScroll = useCallback(() => {
    setIsAutoScrolling(prev => !prev);
  }, []);

  // Auto-scroll for summary command
  const autoScrollForSummary = useCallback(async () => {
    const scrollContainer = readerColumnRef.current;
    if (!scrollContainer) return;

    logger.info('Starting auto-scroll for summary command');
    setIsAutoScrolling(true);

    // Calculate the total scroll distance
    const totalHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const startPosition = scrollContainer.scrollTop;
    
    // Keep track of the last position to detect when we're at the bottom
    let lastPosition = startPosition;
    let isAtBottom = 0; // Changed from boolean to number to use as counter
    
    // Scroll at a faster rate for summary command (to complete faster)
    const summaryScrollSpeed = 5;
    let lastTime = 0;
    
    // Collect content while scrolling (this would be further enhanced to gather content)
    const collectContentWhileScrolling = () => {
      // For demo purposes, we'll just continue scrolling
      if (scrollContainer.scrollTop >= totalHeight || isAtBottom >= 5) {
        // We've reached the bottom, stop auto-scrolling
        setIsAutoScrolling(false);
        window.postMessage({ type: 'AUTO_SCROLL_COMPLETED' }, '*');
        logger.info('Auto-scroll completed, reached end of document');
        return;
      }
      
      // Check if we're stuck (haven't moved)
      if (Math.abs(scrollContainer.scrollTop - lastPosition) < 1) {
        // Increment counter if we're stuck
        if (++isAtBottom >= 5) {
          // We're stuck, consider it done
          setIsAutoScrolling(false);
          window.postMessage({ type: 'AUTO_SCROLL_COMPLETED' }, '*');
          logger.info('Auto-scroll completed, possibly reached end of document');
          return;
        }
      } else {
        // Reset counter if we've moved
        isAtBottom = 0;
      }
      
      // Update last position
      lastPosition = scrollContainer.scrollTop;
      
      // Scroll down
      scrollContainer.scrollBy({
        top: summaryScrollSpeed,
        behavior: 'auto'
      });
      
      // Continue scrolling
      if (isAutoScrolling) {
        requestAnimationFrame(collectContentWhileScrolling);
      } else {
        window.postMessage({ type: 'AUTO_SCROLL_COMPLETED' }, '*');
        logger.info('Auto-scroll stopped manually');
      }
    };
    
    // Start scrolling
    requestAnimationFrame(collectContentWhileScrolling);
    
    // Return cleanup function
    return () => {
      setIsAutoScrolling(false);
    };
  }, []);

  // Initialize auto-scroll when isAutoScrolling state changes
  useEffect(() => {
    const scrollContainer = readerColumnRef.current;
    if (!scrollContainer) return;

    // Calculate average reading speed (approximately 200-250 words per minute for an average reader)
    // Assuming an average of 5 characters per word and 80 characters per line
    // This means approximately 2.5-3 lines per second or roughly 1-2 pixels per 16ms frame
    // We'll make this adjustable later for different reading speeds
    
    // Clear existing interval if any
    if (autoScrollIntervalRef.current) {
      window.clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
    
    // Cancel any existing animation frame
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (isAutoScrolling) {
      // Start auto-scrolling
      const autoScrollFrame = () => {
        if (scrollContainer && !isDraggingRef.current) {
          scrollContainer.scrollBy({
            top: autoScrollSpeed,
            behavior: 'auto' // Using 'auto' for smoother continuous scrolling
          });
        }
      };

      // Use requestAnimationFrame for smoother scrolling
      let lastTime = 0;
      const animateScroll = (timestamp: number) => {
        if (!isAutoScrolling) {
          if (animationFrameRef.current) {
            window.cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          return;
        }
        
        const elapsed = timestamp - lastTime;
        
        // Only update scroll position every 16ms (approximately 60fps)
        if (elapsed >= 16) {
          lastTime = timestamp;
          autoScrollFrame();
        }
        
        animationFrameRef.current = requestAnimationFrame(animateScroll);
      };
      
      animationFrameRef.current = requestAnimationFrame(animateScroll);
      
      // Pause auto-scroll when user manually scrolls
      const pauseOnUserScroll = () => {
        if (isAutoScrolling) {
          setIsAutoScrolling(false);
        }
      };
      
      scrollContainer.addEventListener('wheel', pauseOnUserScroll);
      scrollContainer.addEventListener('touchmove', pauseOnUserScroll);
      
      return () => {
        scrollContainer.removeEventListener('wheel', pauseOnUserScroll);
        scrollContainer.removeEventListener('touchmove', pauseOnUserScroll);
        
        // Clean up when unmounting or changing state
        if (animationFrameRef.current) {
          window.cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };
    }
  }, [isAutoScrolling, autoScrollSpeed]);

  // Listen for auto-scroll requests from other components (like Agent)
  useEffect(() => {
    const handleAutoScrollRequest = (event: MessageEvent) => {
      if (event.data) {
        if (event.data.type === 'START_AUTO_SCROLL_FOR_SUMMARY') {
          // Start auto-scrolling for summary command
          autoScrollForSummary();
        } else if (event.data.type === 'STOP_AUTO_SCROLL_FOR_SUMMARY') {
          // Stop auto-scrolling
          setIsAutoScrolling(false);
        }
      }
    };
    
    window.addEventListener('message', handleAutoScrollRequest);
    return () => {
      window.removeEventListener('message', handleAutoScrollRequest);
    };
  }, [autoScrollForSummary]);

  // Stop auto-scrolling when the Reader component will unmount or be hidden
  useEffect(() => {
    const stopAutoScroll = () => {
      if (isAutoScrolling) {
        setIsAutoScrolling(false);
      }
      
      if (autoScrollIntervalRef.current) {
        window.clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }
      
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
    
    // Listen for visibility change to stop auto-scrolling when tab is hidden
    const handleVisibilityChange = () => {
      if (document.hidden && isAutoScrolling) {
        setIsAutoScrolling(false);
      }
    };
    
    // Listen for page unload to clean up
    const handleBeforeUnload = () => {
      stopAutoScroll();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      stopAutoScroll();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isAutoScrolling]);

  // Close translation popup (if it still exists)
  const handleCloseTranslation = useCallback(() => {
    logger.info('Closing translation popup');
    // Simply reset translation state
    setTranslationState({
      isVisible: false,
      originalText: '',
      translatedText: '',
      position: { x: 0, y: 0 }
    });
  }, []);

  // Add translation handler
  const handleTranslate = useCallback((selectedText: string) => {
    try {
      // Use text from state or passed parameter
      const textToTranslate = selectionState.selectedText || selectedText;
      
      if (textToTranslate && textToTranslate.trim() && readerContentRef.current) {
        logger.info('Starting translation for selected text:', textToTranslate.substring(0, 50));

        // Use TranslationContext method instead of messaging
        findAndTranslateContent(readerContentRef.current, textToTranslate);
        
        // Clear the selection state immediately
        setSelectionState(prev => ({ ...prev, isActive: false }));
      } else {
        logger.warn('No text selected for translation');
      }
    } catch (err) {
      logger.error('Error in handleTranslate:', err);
    }
  }, [selectionState.selectedText, readerContentRef, findAndTranslateContent]);

  // Add effect to monitor translation state changes
  useEffect(() => {
    logger.info('Translation state changed:', translationState);
  }, [translationState]);

  // Handle translation of the entire article
  const handleTranslateArticle = async () => {
    try {
      // Check if user is logged in
      const isLoggedIn = await isAuthenticated();
      
      if (isLoggedIn) {
        // User is logged in, perform translation
        if (readerContentRef.current) {
          translateWithContext(readerContentRef.current);
        }
      } else {
        // User is not logged in, open Agent interface
        logger.info('Global translation requires login, opening Agent interface');
        if (!showAgent) {
          toggleAgent();
        }
      }
    } catch (err) {
      logger.error('Error checking login status:', err);
    }
  };

  // --- Conditional Rendering --- 

  // Handle loading state
  if (isLoading) {
    return (
      <ThemeProvider currentTheme={theme}>
        <div 
          className="flex justify-center items-center h-screen w-screen bg-primary text-primary"
          data-theme={theme}
        >
          <div className="flex flex-col items-center">
            <div className="mb-4 animate-pulse">
              <BookOpenIcon className="w-16 h-16 text-current" />
            </div>
            <p className="text-current font-medium">{t('extractingArticle')}</p>
            <div className="mt-4 w-16 h-1 bg-accent/20 rounded-full overflow-hidden">
              <div className="h-full bg-accent w-1/2 animate-loading"></div>
            </div>
          </div>
        </div>
      </ThemeProvider>
    )
  }
  
  // Handle error state (article not extracted or other errors)
  if (!article || error) {
    return (
      <ThemeProvider currentTheme={theme}>
        <div 
          className="flex justify-center items-center h-screen w-screen bg-primary text-primary"
          data-theme={theme}
        >
          <div className="flex flex-col items-center max-w-md mx-auto p-4 rounded-lg">
            <div className="mb-4 text-error">
              <XCircleIcon className="w-16 h-16 text-current" />
            </div>
            <p className="text-current text-center font-medium">{error || t('couldNotExtract')}</p>
            <button 
              onClick={handleClose}
              className="mt-6 px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-md transition-colors"
            >
              {t('returnToPage')}
            </button>
          </div>
        </div>
      </ThemeProvider>
    )
  }
  
  // --- Main Render --- 

  return (
    <ThemeProvider currentTheme={theme}>
      <ReadingProgress />
      {/* Inline Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1.5 z-[9999] bg-accent/20 pointer-events-none">
        <div 
          className="h-full transition-all duration-150 ease-out bg-accent"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>
      
      {/* Translation Progress Indicator */}
      {isTranslationActive && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-[9999] bg-primary rounded-lg shadow-lg px-4 py-3 flex items-center space-x-3">
          <LanguageIcon className="w-5 h-5 text-accent animate-pulse" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-primary">
              {t('translatingArticle')}... {translationProgressValue}%
            </span>
            <div className="w-48 h-1.5 bg-accent/20 rounded-full mt-1">
              <div 
                className="h-full transition-all duration-150 ease-out bg-accent rounded-full"
                style={{ width: `${translationProgressValue}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Container - the entire screen */}
      <div 
        ref={readerContainerRef}
        className="readlite-reader-container bg-primary text-primary flex flex-col w-full h-full overflow-hidden relative"
        style={{
          ...(isFullscreen ? { userSelect: 'text' } : {}),
        }}
        data-theme={theme}
        data-fullscreen={isFullscreen ? 'true' : 'false'}
        onMouseUp={handleTextSelection}
        onTouchEnd={handleTextSelection}
      >
        {/* Content Container - holds the two columns */}
        <div className="flex flex-row flex-grow h-full">
          {/* Reader Column (left side) */}
          <div 
            ref={readerColumnRef}
            className={`h-full overflow-y-auto relative box-border scrollbar-custom ${
              showAgent ? "" : "w-full"
            } ${isDraggingRef.current ? '' : 'transition-all duration-200 ease-out'}`}
            style={{
              width: showAgent ? `${leftPanelWidth}%` : undefined
            }}
          >
            {/* Reader Content Area */}
            <ReaderContent 
              ref={readerContentRef}
              settings={settings}
              article={article}
              detectedLanguage={detectedLanguage}
              error={error}
            />
            
            {/* Toolbar */}
            <ReaderToolbar 
              showAgent={showAgent}
              leftPanelWidth={leftPanelWidth}
              toggleAgent={toggleAgent}
              handleMarkdownDownload={handleMarkdownDownload}
              toggleSettings={toggleSettings}
              handleClose={handleClose}
              toggleFullscreen={toggleFullscreen}
              isFullscreen={isFullscreen}
              settingsButtonRef={settingsButtonRef}
              showSettings={showSettings}
              isDragging={isDraggingRef.current}
              t={t}
              isAutoScrolling={isAutoScrolling}
              toggleAutoScroll={toggleAutoScroll}
              translateArticle={handleTranslateArticle}
              isTranslating={isTranslationActive}
            />
          </div>

          {/* Divider - only shown when AI panel is visible */}
          {showAgent && (
            <ReaderDivider 
              ref={dividerRef}
              theme={theme}
              isDragging={isDraggingRef.current}
              onDragStart={handleDragStart}
            />
          )}

          {/* AI Column (right side) - only rendered when showAISidePanel is true */}
          {showAgent && (
            <div 
              className={`h-full flex flex-col relative overflow-y-auto border-l border-border ${isDraggingRef.current ? '' : 'transition-all duration-200 ease-out'}`}
              style={{
                width: `${100 - leftPanelWidth}%`
              }}
            >
              <AgentUI
                onClose={toggleAgent}
                initialMessage={t('welcomeMessage')}
                isVisible={showAgent}
                article={article}
                visibleContent={visibleContent}
                baseFontSize={settings.fontSize}
                baseFontFamily={settings.fontFamily}
              />
            </div>
          )}
        </div>
        
        {/* Text selection toolbar */}
        {selectionState.isActive && selectionState.rect && (
          <SelectionToolbar
            isVisible={selectionState.isActive}
            selectionRect={selectionState.rect}
            onHighlight={handleHighlight}
            onClose={() => setSelectionState(prev => ({ ...prev, isActive: false }))}
            highlightElement={selectionState.highlightElement}
            onRemoveHighlight={handleRemoveHighlight}
            onAskAI={handleAskAI}
            onCopy={handleCopy}
            onTranslate={handleTranslate}
            onOpenAgent={toggleAgent}
          />
        )}
        
        {/* Settings Panel */}
        {showSettings && (
          <Settings
            onClose={() => setShowSettings(false)}
            buttonRef={settingsButtonRef}
          />
        )}
      </div>
    </ThemeProvider>
  )
}

export default Reader