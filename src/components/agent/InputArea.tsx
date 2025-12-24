import React, { useRef, useEffect, useState, KeyboardEvent } from 'react';
import { CommonProps, ContextType, Model } from '../../types/agent';
import { Model } from '../../types/api';
import { 
  ChevronDownIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  TrashIcon, 
  XMarkIcon 
} from '@heroicons/react/24/outline';

interface InputAreaProps {
  inputText: string;
  setInputText: (text: string) => void;
  isLoading: boolean;
  isProcessing: boolean;
  onSendMessage: () => void;
  disableSend: boolean;
  activeContext: ContextType; // derived in parent
  onClearSelection?: () => void;
  selectedModel: Model | null;
  setSelectedModel: (model: Model | null) => void;
  availableModels: Model[];
  t: (key: string) => string;
  isAuth?: boolean;
  onClearConversation?: () => void;
  onLogin?: () => void;
  onClose?: () => void;
  selectedText?: string;
}

// QuoteIcon component for consistent use across components
const QuoteIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M7.5 7h3.75m-3.75 3h3.75m3-6H18m-3.75 3H18m-3.75 3H18M4.5 19.5h15a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5h-15A1.5 1.5 0 0 0 3 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
  </svg>
);

const InputArea: React.FC<InputAreaProps> = ({
  inputText,
  setInputText,
  isLoading,
  isProcessing,
  onSendMessage,
  disableSend,
  activeContext,
  onClearSelection,
  selectedModel,
  setSelectedModel,
  availableModels = [],
  t,
  isAuth = false,
  onClearConversation,
  onLogin,
  onClose,
  selectedText = '',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(true);
  const [isReferenceExpanded, setIsReferenceExpanded] = useState(true);

  // Should show reference block
  const shouldShowReference = 
    activeContext === 'selection' && 
    selectedText && 
    selectedText.trim().length > 0;

  // Toggle reference visibility
  const toggleReference = () => {
    setIsReferenceExpanded(!isReferenceExpanded);
  };

  useEffect(() => {
    // Focus the textarea when the component mounts
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disableSend && !isLoading && inputText.trim() !== '') {
        onSendMessage();
      }
    }
  };

  // Set minimum height to 3 lines and maximum height to 8 lines
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get accurate scrollHeight
      textarea.style.height = 'auto';
      
      // Get line height (approx 20px per line)
      const lineHeight = 20;
      const minHeight = lineHeight * 3; // 3 lines minimum
      const maxHeight = lineHeight * 8; // 8 lines maximum
      
      // Set height based on content but within min/max constraints
      textarea.style.height = `${Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight))}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputText]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
  };

  const handleSelectModel = (model: Model) => {
    setSelectedModel(model);
    setShowModelMenu(false);
    textareaRef.current?.focus();
  };

  const getContextLabel = () => {
    switch (activeContext) {
      case 'selection': return t('contextTypeSelection') || 'Selected Text';
      case 'article': return t('contextTypeArticle') || 'Full Article';
      case 'screen': return t('contextTypeScreen') || 'Visible Screen';
      default: return activeContext;
    }
  };

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  // Common classes for menu items
  const menuItemClass = "px-3 py-2 hover:bg-bg-tertiary cursor-pointer transition-colors duration-150 text-xs";
  
  // Common classes for toolbar buttons
  const toolbarButtonClass = "p-1 rounded text-text-secondary/70 hover:text-accent hover:bg-accent/10 transition-colors";

  return (
    <div className="w-full pt-2 pb-2 px-4">
      {/* Reference block for selections */}
      {shouldShowReference && (
        <div className="mb-2 bg-bg-secondary rounded-xl p-2 border border-border/50 shadow-sm">
          <div 
            className="flex items-center justify-between text-xs text-text-secondary/80 mb-1 cursor-pointer hover:text-accent group"
          >
            <div className="flex items-center" onClick={toggleReference}>
              <QuoteIcon className="w-3.5 h-3.5 mr-1 text-text-secondary/60 group-hover:text-accent" />
              <span className="font-medium">{t('selectedText') || 'Selected Text'}</span>
              {isReferenceExpanded ? (
                <ChevronDownIcon className="w-3.5 h-3.5 ml-1" />
              ) : (
                <ChevronRightIcon className="w-3.5 h-3.5 ml-1" />
              )}
            </div>
            {onClearSelection && (
              <button 
                onClick={(e) => { e.stopPropagation(); onClearSelection(); }}
                className="text-text-secondary/50 hover:text-red-500 p-0.5 rounded-full hover:bg-red-500/10 transition-colors"
                title={t('clearSelection') || "Clear selection"}
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          
          {isReferenceExpanded && (
            <div className="pl-2 border-l-2 border-accent/30 py-1.5 pr-2 text-xs bg-bg-primary/5 rounded-r-md 
                           text-text-secondary/60 my-1 leading-relaxed max-h-[100px] overflow-y-auto">
              {selectedText}
            </div>
          )}
        </div>
      )}

      <div className="relative">
        {/* Input container with focus state styling */}
        <div 
          className={`flex flex-col bg-bg-primary hover:border-border rounded-2xl 
                      transition-all duration-200 shadow-sm ${
                        isFocused ? 'border-accent/50 shadow-[0_0_0_2px_var(--readlite-accent)]/10' : ''
                      }`}
        >
          {/* Top toolbar with context status and model selector */}
          <div className="flex justify-between px-4 pt-2 pb-0 text-[9px] text-text-secondary h-[24px]">
            <div className="flex items-center">
               {/* Context Status Pill */}
               <div 
                 className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-colors duration-150 border ${
                   activeContext === 'selection' 
                     ? 'bg-accent/10 text-accent border-accent/20' 
                     : 'bg-bg-tertiary/50 text-text-secondary/70 border-transparent'
                 }`}
               >
                 <span className="text-[9px] font-medium">
                   {activeContext === 'selection' && '✨ '}
                   {activeContext === 'article' && '📄 '}
                   {activeContext === 'screen' && '📱 '}
                   {getContextLabel()}
                 </span>
                 {activeContext === 'selection' && onClearSelection && (
                    <button 
                      onClick={onClearSelection}
                      className="ml-0.5 hover:text-red-500 transition-colors"
                    >
                      <XMarkIcon className="w-2.5 h-2.5" />
                    </button>
                 )}
               </div>
            </div>

            <div className="relative flex items-center gap-2">
              {isToolbarExpanded && (
                <>
                  {/* Login button - only shown when not authenticated */}
                  {!isAuth && onLogin && (
                    <button
                      onClick={onLogin}
                      className="text-[10px] py-0.5 px-2 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                    >
                      {t('login') || "Login"}
                    </button>
                  )}
                  
                  {/* Model selector */}
                  <button
                    className="flex items-center gap-1 p-1 hover:bg-bg-tertiary rounded transition-colors duration-150"
                    onClick={() => setShowModelMenu(!showModelMenu)}
                    aria-label="Select model"
                  >
                    <span className="opacity-90 text-[10px]">
                      {selectedModel ? selectedModel.label : (t('agentDefaultModel') || 'Default')}
                    </span>
                    <ChevronDownIcon
                      className={`w-4 h-4 transition-transform duration-200 ${showModelMenu ? 'rotate-180' : ''}`}
                    />
                  </button>
                </>
              )}
              
              {/* Toolbar collapse button */}
              {isToolbarExpanded ? (
                <button
                  className={toolbarButtonClass}
                  onClick={() => setIsToolbarExpanded(false)}
                  title={t('collapseToolbar') || "Collapse toolbar"}
                >
                  <ChevronRightIcon className="w-3 h-3" />
                </button>
              ) : (
                <button
                  className={toolbarButtonClass}
                  onClick={() => setIsToolbarExpanded(true)}
                  title={t('expandToolbar') || "Expand toolbar"}
                >
                  <ChevronLeftIcon className="w-3 h-3" />
                </button>
              )}
              
              {/* Clear conversation button - only shown when authenticated */}
              {isAuth && onClearConversation && (
                <button
                  onClick={onClearConversation}
                  className={toolbarButtonClass}
                  title={t('clearChat') || "Clear chat"}
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              )}
              
              {/* Close button */}
              {onClose && (
                <button 
                  onClick={onClose}
                  className={toolbarButtonClass}
                  title={t('minimize') || "Close"}
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              )}
              
              {/* Model selection menu */}
              {showModelMenu && availableModels && Array.isArray(availableModels) && (
                <div className="absolute right-0 bottom-full mb-1 z-10 bg-bg-secondary shadow-lg rounded-lg 
                               border border-border py-1 min-w-[150px] overflow-hidden animate-fadeIn">
                  {availableModels.map((model) => (
                    <div
                      key={model.value}
                      className={`${menuItemClass} ${selectedModel?.value === model.value ? 'bg-bg-tertiary' : ''} flex items-center justify-between`}
                      onClick={() => handleSelectModel(model)}
                    >
                      <span>{model.label}</span>
                      {model.inputPrice === 0 && model.outputPrice === 0 && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs rounded-md bg-green-500/20 text-green-500 font-medium">
                          Free
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Text input area */}
          <div className="flex px-4 pt-0.5 pb-1 relative flex-grow">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={t('agentInputPlaceholder') || "Type your message..."}
              disabled={isLoading}
              rows={3}
              className="w-full bg-transparent py-2.5 resize-none outline-none 
                        placeholder:text-text-secondary/50 text-sm pr-10 overflow-y-auto 
                        min-h-[60px] leading-5"
            />
            
            {/* Send button */}
            <button
              onClick={onSendMessage}
              disabled={disableSend || isLoading || inputText.trim() === ''}
              className={`absolute bottom-2 right-4 p-1.5 rounded-lg text-[10px] transition-all duration-200 
                          flex items-center gap-1 ${
                            disableSend || isLoading || inputText.trim() === ''
                              ? 'opacity-50 cursor-not-allowed bg-border/30'
                              : 'bg-accent text-bg-primary hover:bg-accent/90 shadow-sm hover:shadow'
                          }`}
              title={disableSend ? t('agentSendMessage') || 'Send message' : ''}
            >
              {isProcessing ? (
                <span className="flex items-center">
                  <span className="text-xs">{t('agentSending') || 'Sending...'}</span>
                </span>
              ) : (
                t('agentSend') || 'Send'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputArea; 