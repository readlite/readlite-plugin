import React, { useState, useRef, useEffect } from 'react';
import { HighlightColor } from '../../hooks/useTextSelection';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../context/I18nContext';
import { PencilIcon, DocumentTextIcon, XMarkIcon, ClipboardDocumentIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import { createLogger } from '~/utils/logger';

// Create a logger for this module
const logger = createLogger('selection-toolbar');

interface VirtualHighlightElement {
  getAttribute(name: string): string | null;
  hasAttribute?(name: string): boolean;
}

interface TextSelectionToolbarProps {
  isVisible: boolean;
  selectionRect: DOMRect | null;
  onHighlight: (color: HighlightColor) => void;
  onClose: () => void;
  highlightElement?: Element | VirtualHighlightElement | null;
  onRemoveHighlight?: (element: Element | VirtualHighlightElement) => void;
  onCopy?: () => Promise<void> | void;
}

// Define a more extensive type for highlight colors with proper names
interface HighlightColorOption {
  color: HighlightColor;
  name: string;
  description: string;
  value: string; // The actual color value
}

const SelectionToolbar: React.FC<TextSelectionToolbarProps> = ({
  isVisible,
  selectionRect,
  onHighlight,
  onClose,
  highlightElement,
  onRemoveHighlight,
  onCopy
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  
  const { theme } = useTheme();
  const { t, uiLanguage } = useI18n(); // Get translation function and language
  
  // Adjust button width based on language
  const isChinese = uiLanguage.startsWith('zh');

  // Enhanced highlight color scheme with sophisticated colors
  const highlightColors: HighlightColorOption[] = [
    {
      color: 'beige',
      name: 'beige',
      description: 'Warm and soft, suitable for long-term reading, comfortable on the eyes, not easy to fatigue.',
      value: 'rgb(255, 245, 230)'
    },
    {
      color: 'cyan',
      name: 'cyan',
      description: 'Clear and easy to distinguish, suitable for marking concepts and definitions.',
      value: 'rgb(181, 228, 255)'
    },
    {
      color: 'lavender',
      name: 'lavender',
      description: 'Elegant and conspicuous, suitable for important points.',
      value: 'rgb(220, 198, 255)'
    },
    {
      color: 'olive',
      name: 'olive',
      description: 'Natural and peaceful, suitable for auxiliary information.',
      value: 'rgb(222, 234, 181)'
    },
    {
      color: 'peach',
      name: 'peach',
      description: 'Warm and lively, suitable for personal insights.',
      value: 'rgb(255, 204, 153)'
    },
  ];

  // If toolbar is not visible to user, don't render
  if (!isVisible || !selectionRect) {
    return null;
  }

  // Calculate toolbar position, prioritize showing below the selection, ensure it's within viewport
  const calculatePosition = () => {
    if (!selectionRect) return { top: 0, left: 0 };

    const toolbarWidth = isChinese ? 320 : 360; // Estimated toolbar width
    const toolbarHeight = 90; // Estimated toolbar height
    const spacing = 12;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Make sure the rectangle values are valid numbers
    const rect = {
      left: isFinite(selectionRect.left) ? selectionRect.left : 0,
      top: isFinite(selectionRect.top) ? selectionRect.top : 0,
      right: isFinite(selectionRect.right) ? selectionRect.right : 0,
      bottom: isFinite(selectionRect.bottom) ? selectionRect.bottom : 0,
      width: isFinite(selectionRect.width) ? selectionRect.width : 0,
      height: isFinite(selectionRect.height) ? selectionRect.height : 0
    };

    // Center the toolbar horizontally relative to the selection
    let left = rect.left + (rect.width / 2) - (toolbarWidth / 2);
    
    // Position default: below the selection
    let top = rect.bottom + spacing;
    
    // If not enough space below, place above
    if (top + toolbarHeight > viewportHeight - 10) {
      top = rect.top - toolbarHeight - spacing;
    }

    // Ensure toolbar remains within viewport bounds
    if (left + toolbarWidth > viewportWidth - 10) {
      left = viewportWidth - toolbarWidth - 10;
    }
    
    if (left < 10) {
      left = 10;
    }
    
    // Ensure top is never negative
    if (top < 10) {
      top = 10;
    }
    
    return { top, left };
  };

  const position = calculatePosition();

  // Debug log when component renders
  useEffect(() => {
    console.log('TextSelectionToolbar rendered, showColorPicker:', showColorPicker);
  });

  // Handle clicking outside to close toolbar
  useEffect(() => {
    if (!toolbarRef.current) return;
    
    const doc = toolbarRef.current.ownerDocument || document;
    
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click is outside the toolbar and not on selected text
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        // Don't close the toolbar if user is clicking on selected text
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
          // Get the range and check if the click was inside it
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          // Check if click is within selection area
          if (event.clientX >= rect.left && event.clientX <= rect.right &&
              event.clientY >= rect.top && event.clientY <= rect.bottom) {
            return;
          }
        }
        
        // Otherwise, close the toolbar
        setShowColorPicker(false);
        onClose();
      }
    };

    doc.addEventListener('mousedown', handleClickOutside);
    return () => {
      doc.removeEventListener('mousedown', handleClickOutside);
    };
  }, [toolbarRef.current, onClose]);

  // Add listener for selection changes to close toolbar when selection is lost
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.isCollapsed) {
        // Selection is collapsed (no text selected), close the toolbar
        onClose();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [onClose]);

  // Handle direct highlight button click to show color picker
  const handleHighlightClick = (e: React.MouseEvent) => {
    // Use preventDefault to avoid losing selection in iframe
    e.preventDefault();
    e.stopPropagation();
    console.log('Highlight button clicked, toggling color picker:', !showColorPicker);
    setShowColorPicker(prev => !prev);
  };

  const handleApplyHighlight = (color: HighlightColor, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`Applying highlight color: ${color}`);
    
    // Don't close the toolbar after highlighting
    onHighlight(color);
    setShowColorPicker(false);
  };

  // Handle copy button click
  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onCopy) {
      // Use the callback provided by parent component
      await onCopy();
      setIsCopied(true);
      setTimeout(() => {
        onClose();
      }, 500);
    } else {
      // If no callback is provided, show a message
      console.warn('Copy functionality requires onCopy callback');
      alert(t('comingSoon'));
    }
  };

  // Handle removing highlight
  const handleRemoveHighlight = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isRemoving) {
      return;
    }
    
    if (highlightElement && onRemoveHighlight) {
      try {
        setIsRemoving(true);
        
        console.log('Removing highlight element:', highlightElement);
        // Check if there is a highlight ID
        const highlightId = highlightElement.getAttribute('data-highlight-id');
        if (!highlightId) {
          console.warn('Highlight element missing data-highlight-id attribute');
        }
        
        onRemoveHighlight(highlightElement);
      } catch (error) {
        console.error('Error in handleRemoveHighlight:', error);
      } finally {
        onClose();
        
        setTimeout(() => {
          setIsRemoving(false);
        }, 300);
      }
    } else {
      console.warn('Cannot remove highlight: Missing element or callback');
      onClose();
    }
  };

  return (
    <div 
      ref={toolbarRef}
      className={`fixed z-[9999] transform -translate-x-1/2 transition-all duration-200 ease-out ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
      }`}
      style={calculatePosition()}
    >
      {/* Glass container with modern styling */}
      <div className={`
        relative overflow-hidden rounded-xl shadow-lg
        ${theme === 'dark' 
          ? 'bg-neutral-800/95 border border-neutral-700/50' 
          : 'bg-white/95 border border-neutral-200/80'}
        backdrop-blur-md p-1.5
      `}>
        {/* Main Toolbar */}
        <div className="flex flex-col">
          {/* Top row of buttons */}
          <div className="flex items-center gap-1">
            {/* 1. COPY BUTTON */}
            <ToolbarButton
              onMouseDown={handleCopy}
              isActive={isCopied}
              activeColor="accent"
              icon={
                <div className="relative w-5 h-5">
                  <ClipboardDocumentIcon className={`absolute inset-0 w-5 h-5 transition-all ${isCopied ? 'opacity-0 scale-90' : 'opacity-100'}`} />
                  <CheckIcon className={`absolute inset-0 w-5 h-5 transition-all ${isCopied ? 'opacity-100 text-accent' : 'opacity-0 scale-110'}`} />
                </div>
              }
              label={isCopied ? t('copied') : t('copy')}
              isDark={theme === 'dark'}
              width={isChinese ? 48 : 56}
            />
            
            {/* 2. HIGHLIGHT or DELETE HIGHLIGHT */}
            {!highlightElement ? (
              <ToolbarButton
                onMouseDown={handleHighlightClick}
                isActive={showColorPicker}
                activeColor="accent"
                icon={<PencilIcon className="w-5 h-5" />}
                label={t('highlight')}
                isDark={theme === 'dark'}
                width={isChinese ? 48 : 56}
              />
            ) : (
              highlightElement && onRemoveHighlight && (
                <ToolbarButton
                  onMouseDown={handleRemoveHighlight}
                  icon={<TrashIcon className="w-5 h-5" />}
                  label={t('delete')}
                  isDark={theme === 'dark'}
                  width={isChinese ? 48 : 56}
                  warningAction
                />
              )
            )}

            {/* 3. NOTE BUTTON */}
            <ToolbarButton
              onMouseDown={() => alert(t('comingSoon'))}
              icon={<DocumentTextIcon className="w-5 h-5" />}
              label={t('addNote')}
              isDark={theme === 'dark'}
              width={isChinese ? 48 : 56}
            />

            {/* 6. CLOSE BUTTON - at the end */}
            <ToolbarButton
              onMouseDown={onClose}
              icon={<XMarkIcon className="w-5 h-5" />}
              label={t('close')}
              isDark={theme === 'dark'}
              width={isChinese ? 48 : 56}
              warningAction
            />
          </div>
          
          {/* Second row - Color picker under the highlight button */}
          {showColorPicker && !highlightElement && (
            <div className="flex justify-center mt-1 mb-0.5">
              <div 
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-full
                  ${theme === 'dark' ? 'bg-neutral-700/40' : 'bg-neutral-100/80'}
                `}
                style={{ 
                  marginLeft: isChinese ? "48px" : "56px" // Align under the highlight button
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                {highlightColors.map((item) => (
                  <button
                    key={item.color}
                    onMouseDown={(e) => handleApplyHighlight(item.color, e)}
                    className="w-6 h-6 rounded-full hover:scale-110 transition-transform"
                    style={{
                      backgroundColor: item.value,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}
                    title={item.description}
                    aria-label={item.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Reusable Button Component for Selection Toolbar
interface ToolbarButtonProps {
  onMouseDown: (e: React.MouseEvent) => void;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  activeColor?: string;
  specialColor?: string;
  warningAction?: boolean;
  isDark?: boolean;
  width: number;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onMouseDown,
  icon,
  label,
  isActive = false,
  activeColor = 'accent',
  specialColor,
  warningAction = false,
  isDark = false,
  width
}) => {
  const getButtonClasses = () => {
    const baseClasses = "group flex flex-col items-center justify-center rounded-lg transition-all duration-150 p-1.5";
    
    if (isActive) {
      return `${baseClasses} ${activeColor === 'accent' ? 'bg-accent/10 text-accent' : 'bg-accent/10 text-accent'} shadow-sm`;
    }
    
    // Warning actions like delete or close
    if (warningAction) {
      return `${baseClasses} text-neutral-500 hover:text-red-500 hover:bg-red-50/50`;
    }
    
    // Special color for certain buttons (like AI)
    if (specialColor === 'accent') {
      return `${baseClasses} text-neutral-500 hover:text-accent hover:bg-accent/5`;
    }
    
    // Default state
    return `${baseClasses} text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/60 dark:hover:bg-neutral-700/30`;
  };
  
  const getTextClasses = () => {
    if (isActive) {
      return "text-xs font-medium mt-1 text-center text-current";
    }
    if (warningAction) {
      return "text-xs font-medium mt-1 text-center text-neutral-500 group-hover:text-red-500";
    }
    if (specialColor === 'accent') {
      return "text-xs font-medium mt-1 text-center text-neutral-500 group-hover:text-accent";
    }
    return "text-xs font-medium mt-1 text-center text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-200";
  };
  
  return (
    <button
      onMouseDown={onMouseDown}
      className={getButtonClasses()}
      style={{ width }}
      title={label}
      aria-label={label}
    >
      <div className="w-6 h-6 flex items-center justify-center">
        {icon}
      </div>
      <span className={getTextClasses()}>
        {label}
      </span>
    </button>
  );
};

export default SelectionToolbar;