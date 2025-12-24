import React, { forwardRef, useEffect, useRef, useMemo, useState } from 'react';
import { LanguageCode } from '~/utils/language';
import { ThemeType } from '~/config/theme';
import { useTextSelection } from '~/hooks/useTextSelection';
import { useTheme } from '~/context/ThemeContext';
import { useI18n } from '~/context/I18nContext';
import { useTranslation } from '~/context/TranslationContext';
import llmClient from '~/services/llmClient';
import { createLogger } from "~/utils/logger";

// Create a logger for this module
const logger = createLogger('reader-content');

// Constants for typography settings
const TYPOGRAPHY = {
  paragraphSpacing: {
    min: 0.5,  // Multiplier of line height
    max: 1.5,
    default: 0.8
  },
  margins: {
    min: 16,
    default: 32,
    max: 32
  },
  fontSizeThresholds: {
    small: 14,
    large: 20
  },
  headingSizeMultipliers: {
    h1: 1.6,
    h2: 1.4,
    h3: 1.2,
    h4: 1.1,
    h5: 1.0,
    h6: 1.0
  },
  codeBlockFontSizeReduction: 2,
  minCodeFontSize: 13,
  scrollbarHeight: '6px',
  scrollbarBorderRadius: '3px'
};

// List of CJK (Chinese, Japanese, Korean) language codes
const CJK_LANGUAGES = ['zh', 'ja', 'ko'];

// Selector for content elements that need translation
const TRANSLATABLE_CONTENT_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption, td, th, caption, div.content-text, pre, pre > code';

// Selector for content elements that need font styling
const CONTENT_ELEMENTS_SELECTOR = 'p, li, blockquote, div:not(.code-lang-label):not(.readlite-byline)';

// Monospace font stack for code blocks
const MONOSPACE_FONT_STACK = 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace';

/**
 * Helper function to convert hex to rgb for CSS variables
 */
const hexToRgb = (hex: string): string => {
  // Handle non-hex colors
  if (!hex || !hex.startsWith('#')) return '0, 0, 0';
  
  // Remove the hash
  hex = hex.replace('#', '');
  
  // Convert 3-digit hex to 6-digit hex
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  
  // Parse the hex values
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  return `${r}, ${g}, ${b}`;
};

/**
 * Helper function to get Tailwind font family class
 */
const getFontFamilyClass = (fontFamily: string): string => {
  if (fontFamily.includes('serif')) return 'font-serif';
  if (fontFamily.includes('mono')) return 'font-mono';
  return 'font-sans';
};

/**
 * Helper function to get Tailwind text align class
 */
const getTextAlignClass = (textAlign: string): string => {
  if (!textAlign) return 'text-left';
  return `text-${textAlign}`;
};

/**
 * Calculate node index in parent
 */
const getNodeIndex = (node: Node): number => {
  let index = 0;
  let sibling = node.previousSibling;
  while (sibling) {
    index++;
    sibling = sibling.previousSibling;
  }
  return index;
};

/**
 * Get path from root to node
 */
const getPathToNode = (node: Node, root: Node): number[] => {
  const path: number[] = [];
  let currentNode = node;
  
  while (currentNode !== root && currentNode.parentNode) {
    path.unshift(getNodeIndex(currentNode));
    currentNode = currentNode.parentNode;
  }
  
  return path;
};

interface ReaderContentProps {
  settings: {
    theme: ThemeType;
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    textAlign: string;
    width: number;
  };
  article: any;
  detectedLanguage: LanguageCode;
  error: string | null;
}

/**
 * Displays the article content in a well-formatted reader view
 */
const ReaderContent = forwardRef<HTMLDivElement, ReaderContentProps>(
  ({ settings, article, detectedLanguage, error }, ref) => {
    // Context hooks
    const { getReaderColors, theme } = useTheme();
    const { t } = useI18n();
    const { findAndTranslateContent } = useTranslation();
    
    // Refs
    const contentRef = useRef<HTMLDivElement | null>(null);
    const translationCache = useRef<Map<string, string>>(new Map());
    const hasTranslationSetup = useRef(false);
    
    // Selection hook
    const { selection, applyHighlight, removeHighlight } = useTextSelection(contentRef);
    
    // Memoized values
    const readerColors = useMemo(() => getReaderColors(), [getReaderColors, theme]);
    const isCJKLanguage = useMemo(() => CJK_LANGUAGES.includes(detectedLanguage), [detectedLanguage]);
    
    // Translation state
    const [isDocumentTranslated, setIsDocumentTranslated] = useState(false);
    const [translationInProgress, setTranslationInProgress] = useState(false);
    const [translatedElements, setTranslatedElements] = useState<Map<string, string>>(new Map());

    /**
     * Calculate optimal line height based on font size
     */
    const getOptimalLineHeight = useMemo(() => {
      const { small, large } = TYPOGRAPHY.fontSizeThresholds;
      
      // Smaller font sizes need larger line height ratios
      if (settings.fontSize < small) {
        return Math.max(settings.lineHeight, 1.5);
      } else if (settings.fontSize > large) {
        return Math.min(settings.lineHeight, 1.6);
      }
      
      return settings.lineHeight;
    }, [settings.fontSize, settings.lineHeight]);
    
    /**
     * Calculate paragraph spacing based on line height
     */
    const getParagraphSpacing = useMemo(() => {
      const baseSpacing = getOptimalLineHeight * settings.fontSize;
      return `${baseSpacing * TYPOGRAPHY.paragraphSpacing.default}px`;
    }, [getOptimalLineHeight, settings.fontSize]);

    // Generate Tailwind class names
    const fontFamilyClass = useMemo(() => getFontFamilyClass(settings.fontFamily), [settings.fontFamily]);
    const textAlignClass = useMemo(() => getTextAlignClass(settings.textAlign), [settings.textAlign]);

    /**
     * Apply code block language labels
     */
    useEffect(() => {
      if (!ref || !('current' in ref) || !ref.current || !article) return;
      
      try {
        const codeBlocks = ref.current.querySelectorAll('pre + div');
        
        codeBlocks.forEach((langDiv: Element) => {
          const pre = langDiv.previousElementSibling as HTMLPreElement;
          // Ensure the previous sibling is indeed a <pre> tag
          if (!pre || pre.tagName !== 'PRE') return;
          
          // Check for language info within the div
          const langSpan = langDiv.querySelector('p > span, span');
          if (langSpan?.textContent) {
            processCodeBlockLanguageLabel(pre, langSpan.textContent.trim(), langDiv);
          }
        });
      } catch (error) {
        logger.error(`Error during code block DOM manipulation:`, error);
      }
    }, [article, ref]);

    /**
     * Process a single code block language label
     */
    const processCodeBlockLanguageLabel = (
      preElement: HTMLPreElement,
      languageName: string,
      languageDiv: Element
    ) => {
      // Ensure <pre> can contain the absolutely positioned label
      if (window.getComputedStyle(preElement).position === 'static') {
        preElement.style.position = 'relative';
      }
      
      // Check if label already exists to prevent duplicates
      const existingLabel = preElement.querySelector('.code-lang-label');
      if (!existingLabel) {
        const langLabel = document.createElement('div');
        langLabel.className = 'code-lang-label absolute top-0 right-0 bg-primary/10 text-primary/70 text-xs px-2 py-1 rounded-bl font-mono';
        langLabel.textContent = languageName;
        preElement.appendChild(langLabel);
      }
      
      // Hide the original language div
      (languageDiv as HTMLElement).style.display = 'none';
    };

    /**
     * Apply font settings to content elements
     */
    useEffect(() => {
      if (!ref || typeof ref !== 'object' || !ref.current) return;
      
      try {
        const content = ref.current;
        applyFontVariablesToRoot(content);
        applyFontStylesToContentElements(content);
        applyFontStylesToCodeBlocks(content);
      } catch (error) {
        logger.error("Error applying font settings:", error);
      }
    }, [settings.fontFamily, settings.fontSize, getOptimalLineHeight, getParagraphSpacing, ref]);

    /**
     * Apply font variables to root element
     */
    const applyFontVariablesToRoot = (contentElement: HTMLElement) => {
      contentElement.style.setProperty('--readlite-reader-font-size', `${settings.fontSize}px`);
      contentElement.style.setProperty('--readlite-reader-line-height', getOptimalLineHeight.toString());
      contentElement.style.fontFamily = settings.fontFamily;
    };

    /**
     * Apply font styles to content elements
     */
    const applyFontStylesToContentElements = (contentElement: HTMLElement) => {
      const contentElements = contentElement.querySelectorAll(CONTENT_ELEMENTS_SELECTOR);
      
      contentElements.forEach((el: Element) => {
        const htmlEl = el as HTMLElement;
        
        // Use direct style settings for consistent control
        htmlEl.style.fontSize = `${settings.fontSize}px`;
        htmlEl.style.lineHeight = getOptimalLineHeight.toString();
        htmlEl.style.fontFamily = settings.fontFamily;
        
        // For paragraphs, add margin bottom
        if (el.tagName === 'P') {
          htmlEl.style.marginBottom = getParagraphSpacing;
        }
      });
    };

    /**
     * Apply font styles to code blocks
     */
    const applyFontStylesToCodeBlocks = (contentElement: HTMLElement) => {
      const codeBlocks = contentElement.querySelectorAll('pre, code');
      const { minCodeFontSize, codeBlockFontSizeReduction } = TYPOGRAPHY;
      
      codeBlocks.forEach((el: Element) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.fontFamily = MONOSPACE_FONT_STACK;
        htmlEl.style.fontSize = `${Math.max(minCodeFontSize, settings.fontSize - codeBlockFontSizeReduction)}px`;
      });
    };

    /**
     * Apply theme colors to article content
     */
    useEffect(() => {
      if (!ref || !('current' in ref) || !ref.current) return;
      
      try {
        const content = ref.current;
        content.setAttribute('data-theme', theme);
        
        return applyLinkStyles(content, readerColors);
      } catch (error) {
        logger.error("Error applying text colors:", error);
      }
    }, [readerColors, ref, theme]);

    /**
     * Apply link styles with proper event listener management
     */
    const applyLinkStyles = (contentElement: HTMLElement, colors: any) => {
      const links = contentElement.querySelectorAll('a');
      const mouseEnterListeners: Array<{ element: HTMLElement, listener: EventListener }> = [];
      const mouseLeaveListeners: Array<{ element: HTMLElement, listener: EventListener }> = [];
      
      links.forEach((el: Element) => {
        const link = el as HTMLElement;
        
        // Use direct color from readerColors
        link.style.color = colors.link.normal;
        
        // Add hover effect with properly stored references for cleanup
        const enterListener = () => {
          link.style.color = colors.link.hover;
        };
        
        const leaveListener = () => {
          link.style.color = colors.link.normal;
        };
        
        link.addEventListener('mouseenter', enterListener);
        link.addEventListener('mouseleave', leaveListener);
        
        // Store references for cleanup
        mouseEnterListeners.push({ element: link, listener: enterListener });
        mouseLeaveListeners.push({ element: link, listener: leaveListener });
      });
      
      // Cleanup function to remove event listeners
      return () => {
        mouseEnterListeners.forEach(({ element, listener }) => {
          element.removeEventListener('mouseenter', listener);
        });
        
        mouseLeaveListeners.forEach(({ element, listener }) => {
          element.removeEventListener('mouseleave', listener);
        });
      };
    };

    /**
     * Add paragraph IDs for translation
     */
    useEffect(() => {
      if (!contentRef.current || !article) return;
      
      try {
        // Add ID identifiers to all translatable content elements
        const content = contentRef.current;
        addContentIds(content);
        
        // Add message event listener for translation requests
        const handleTranslateSelection = async (event: MessageEvent) => {
          if (event.data?.type === 'TRANSLATE_SELECTION') {
            await handleTranslationRequest(event);
          }
        };
        
        window.addEventListener('message', handleTranslateSelection);
        
        // Cleanup function
        return () => {
          window.removeEventListener('message', handleTranslateSelection);
        };
      } catch (error) {
        logger.error('Error in translation setup:', error);
      }
    }, [article]);

    /**
     * Add IDs to all content elements for translation
     */
    const addContentIds = (contentElement: HTMLElement) => {
      const contentElements = contentElement.querySelectorAll(TRANSLATABLE_CONTENT_SELECTOR);
      
      contentElements.forEach((element, index) => {
        const tagName = element.tagName.toLowerCase();
        // Avoid adding IDs to elements that already have one or empty elements
        if (!element.getAttribute('data-content-id') && element.textContent?.trim()) {
          element.setAttribute('data-content-id', `${tagName}-${index}`);
        }
      });
      
      logger.info(`Added IDs to ${contentElements.length} content elements for translation`);
    };

    /**
     * Handle translation request from message event
     */
    const handleTranslationRequest = async (event: MessageEvent) => {
      try {
        // Check if we have explicit text from the message
        if (event.data.selectedText && contentRef.current) {
          await findAndTranslateContent(contentRef.current, event.data.selectedText);
        } else {
          // Use current selection
          const doc = contentRef.current?.ownerDocument || document;
          const selection = doc.getSelection();
          
          if (selection && !selection.isCollapsed && contentRef.current) {
            await findAndTranslateContent(contentRef.current, selection.toString());
          }
        }
        
        // Clear the text selection after translation is complete
        const doc = contentRef.current?.ownerDocument || document;
        doc.getSelection()?.removeAllRanges();
        
      } catch (error) {
        logger.error('Error in translate selection handler:', error);
      }
    };

    /**
     * Send text selection state to parent component via messages
     */
    useEffect(() => {
      if (selection.isActive && selection.rect) {
        sendSelectionToParent();
      }
    }, [selection]);

    /**
     * Process and send selection data to parent window
     */
    const sendSelectionToParent = () => {
      try {
        // Don't pass the DOM element directly, it's not serializable
        // If there is a highlightElement, only pass its ID
        const highlightData = selection.highlightElement ? {
          id: selection.highlightElement.getAttribute('data-highlight-id'),
          color: selection.highlightElement.getAttribute('data-highlight-color')
        } : null;
        
        // Get the selected text when selection is active
        const selectedText = selection.text || "";
        
        // Get DOM path information
        let domPath = null;
        try {
          domPath = getDomPathFromSelection();
        } catch (pathError) {
          logger.error('Error generating DOM path:', pathError);
        }
        
        window.postMessage({
          type: 'TEXT_SELECTED',
          isActive: selection.isActive,
          rect: selection.rect,
          highlightData,
          selectedText,
          domPath
        }, '*');
      } catch (error) {
        logger.error('Error sending selection data:', error);
      }
    };

    /**
     * Get DOM path data from current selection
     */
    const getDomPathFromSelection = () => {
      const doc = contentRef.current?.ownerDocument || document;
      const sel = doc.getSelection();
      
      if (!sel || !sel.rangeCount) return null;
      
      const range = sel.getRangeAt(0);
      const root = contentRef.current;
      
      if (!root) return null;
      
      // Get selection start and end DOM paths
      return {
        startPath: getPathToNode(range.startContainer, root),
        endPath: getPathToNode(range.endContainer, root),
        startOffset: range.startOffset,
        endOffset: range.endOffset
      };
    };

    /**
     * Listen for messages from parent to handle various requests
     */
    useEffect(() => {
      // Set up message handlers
      const messageHandlers = {
        HIGHLIGHT_TEXT: handleHighlightMessage,
        REMOVE_HIGHLIGHT: handleRemoveHighlightMessage,
        COPY_SELECTION: handleCopySelectionMessage
      };
      
      // Unified message handler
      const handleMessage = (event: MessageEvent) => {
        if (!event.data || !event.data.type) return;
        
        const handler = messageHandlers[event.data.type as keyof typeof messageHandlers];
        if (handler) {
          handler(event);
        }
      };
      
      // Add unified message event listener
      window.addEventListener('message', handleMessage);
      
      // Clean up event listeners
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }, [applyHighlight, removeHighlight]);

    /**
     * Handle highlight message from parent
     */
    const handleHighlightMessage = (event: MessageEvent) => {
      if (event.data?.type === 'HIGHLIGHT_TEXT' && event.data.color) {
        applyHighlight(event.data.color);
      }
    };

    /**
     * Handle remove highlight message from parent
     */
    const handleRemoveHighlightMessage = (event: MessageEvent) => {
      if (event.data?.type === 'REMOVE_HIGHLIGHT' && event.data.highlightId) {
        const contentElement = contentRef.current;
        if (!contentElement) return;
        
        const highlightToRemove = contentElement.querySelector(
          `span[data-highlight-id="${event.data.highlightId}"]`
        );
        
        if (highlightToRemove) {
          removeHighlight(highlightToRemove);
        }
      }
    };

    /**
     * Handle copy selection message from parent
     */
    const handleCopySelectionMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'COPY_SELECTION') return;
      
      try {
        const textToCopy = getTextToCopy(event);
        
        if (textToCopy) {
          copyTextToClipboard(textToCopy);
        } else {
          sendCopyFailure('No text selected');
        }
      } catch (error) {
        sendCopyFailure(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    /**
     * Get text to copy from selection or event data
     */
    const getTextToCopy = (event: MessageEvent) => {
      // Get the current selection from the document
      const contentElement = contentRef.current;
      const doc = contentElement?.ownerDocument || document;
      const selection = doc.getSelection();
      
      if (selection && !selection.isCollapsed) {
        return selection.toString();
      } else if (event.data?.selectedText) {
        return event.data.selectedText;
      }
      
      return '';
    };

    /**
     * Copy text to clipboard and send success message
     */
    const copyTextToClipboard = (text: string) => {
      navigator.clipboard.writeText(text)
        .then(() => {
          window.postMessage({
            type: 'COPY_SELECTION_COMPLETE',
            success: true
          }, '*');
        })
        .catch(err => {
          sendCopyFailure(err.message);
        });
    };

    /**
     * Send copy failure message to parent
     */
    const sendCopyFailure = (errorMessage: string) => {
      window.postMessage({
        type: 'COPY_SELECTION_COMPLETE',
        success: false,
        error: errorMessage
      }, '*');
    };

    /**
     * Generate dynamic CSS styles for the content
     */
    const generateContentStyles = () => {
      return `
        .readlite-reader-content {
          --readlite-reader-font-size: ${settings.fontSize}px;
          --readlite-reader-line-height: ${getOptimalLineHeight};
          font-family: ${settings.fontFamily};
          
          /* Extract RGB values from theme colors for rgba() usage */
          --readlite-accent-rgb: ${hexToRgb(readerColors.link.normal)};
          --readlite-bg-secondary-rgb: ${hexToRgb(readerColors.background)};
        }
        
        .readlite-reader-content p,
        .readlite-reader-content li, 
        .readlite-reader-content blockquote,
        .readlite-reader-content div:not(.code-lang-label):not(.readlite-byline) {
          font-size: var(--readlite-reader-font-size);
          line-height: var(--readlite-reader-line-height);
          font-family: ${settings.fontFamily};
        }
        
        .readlite-reader-content p {
          margin-bottom: ${getParagraphSpacing};
        }
        
        .readlite-reader-content pre,
        .readlite-reader-content code {
          font-family: ${MONOSPACE_FONT_STACK};
          font-size: ${Math.max(TYPOGRAPHY.minCodeFontSize, settings.fontSize - TYPOGRAPHY.codeBlockFontSizeReduction)}px;
        }
        
        .readlite-reader-content h1 { font-size: calc(var(--readlite-reader-font-size) * ${TYPOGRAPHY.headingSizeMultipliers.h1}); }
        .readlite-reader-content h2 { font-size: calc(var(--readlite-reader-font-size) * ${TYPOGRAPHY.headingSizeMultipliers.h2}); }
        .readlite-reader-content h3 { font-size: calc(var(--readlite-reader-font-size) * ${TYPOGRAPHY.headingSizeMultipliers.h3}); }
        .readlite-reader-content h4 { font-size: calc(var(--readlite-reader-font-size) * ${TYPOGRAPHY.headingSizeMultipliers.h4}); }
        .readlite-reader-content h5 { font-size: calc(var(--readlite-reader-font-size) * ${TYPOGRAPHY.headingSizeMultipliers.h5}); }
        .readlite-reader-content h6 { font-size: var(--readlite-reader-font-size); }
        
        .readlite-reader-content pre {
          overflow-x: auto;
          white-space: pre-wrap;
          max-width: 100%;
          word-break: break-word;
          word-wrap: break-word;
          padding: 1rem;
          border-radius: 0.375rem;
          scrollbar-width: thin;
          scrollbar-color: rgba(var(--readlite-accent-rgb), 0.3) transparent;
        }
        
        .readlite-reader-content pre::-webkit-scrollbar {
          height: ${TYPOGRAPHY.scrollbarHeight};
        }
        
        .readlite-reader-content pre::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .readlite-reader-content pre::-webkit-scrollbar-thumb {
          background-color: rgba(var(--readlite-accent-rgb), 0.3);
          border-radius: ${TYPOGRAPHY.scrollbarBorderRadius};
        }
        
        .readlite-reader-content pre::-webkit-scrollbar-thumb:hover {
          background-color: rgba(var(--readlite-accent-rgb), 0.5);
        }
        
        .readlite-reader-content pre code {
          white-space: pre-wrap;
          display: block;
        }
      `;
    };

    /**
     * Render article title component
     */
    const renderArticleTitle = () => {
      if (!article?.title) return null;
      
      return (
        <h1 
          className="mb-4 mt-4 font-semibold transition-colors duration-300 text-primary"
          style={{
            letterSpacing: isCJKLanguage ? '0.02em' : '0',
            fontFamily: settings.fontFamily
          }}
        >
          {article.title}
        </h1>
      );
    };

    /**
     * Render article byline component
     */
    const renderArticleByline = () => {
      if (!article?.byline) return null;
      
      return (
        <div className="mb-8 opacity-75 text-secondary readlite-byline text-md">
          {article.byline}
        </div>
      );
    };

    /**
     * Render article content component
     */
    const renderArticleContent = () => {
      if (!article?.content) return null;
      
      return (
        <div 
          dangerouslySetInnerHTML={{ __html: article.content }}
          className="content text-primary"
        />
      );
    };

    /**
     * Render error message component
     */
    const renderErrorMessage = () => {
      if (!error) return null;
      
      return (
        <div className="mt-16 text-center">
          <h2 className="text-xl font-semibold mb-4 text-error">
            Error loading content
          </h2>
          <p className="text-error">{error}</p>
        </div>
      );
    };

    return (
      <div 
        ref={(element) => {
          // Set both ref and contentRef
          if (ref && typeof ref === 'function') {
            ref(element);
          } else if (ref) {
            ref.current = element;
          }
          contentRef.current = element;
        }}
        className={`
          readlite-reader-content 
          lang-${detectedLanguage} 
          mx-auto my-8 px-[48px] py-8
          relative
          ${fontFamilyClass}
          ${textAlignClass}
          bg-primary
          text-primary
          antialiased
          shadow-md
          rounded-md
          transition-colors duration-300
          ${isDocumentTranslated ? 'readlite-document-translated' : ''}
        `}
        style={{
          maxWidth: `${settings.width}px`,
          '--readlite-reader-font-size': `${settings.fontSize}px`,
          '--readlite-reader-line-height': getOptimalLineHeight.toString(),
        } as React.CSSProperties}
        data-font-size={settings.fontSize}
        data-line-height={getOptimalLineHeight}
        data-theme={theme}
        data-translated={isDocumentTranslated ? 'true' : 'false'}
      >
        {/* CSS variables for font properties that need to be dynamic */}
        <style>{generateContentStyles()}</style>
        
        {/* Article content */}
        {article && (
          <>
            {renderArticleTitle()}
            {renderArticleByline()}
            {renderArticleContent()}
          </>
        )}
        
        {renderErrorMessage()}
      </div>
    );
  }
);

export default ReaderContent; 