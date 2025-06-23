import React, { useState, useEffect } from 'react';
import { Message, ContextType, ConfirmationData } from './types';
import { useTheme } from '../../context/ThemeContext';
import { ChevronDownIcon, ChevronUpIcon, ExclamationCircleIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { createLogger } from '../../utils/logger';

// Create a logger for MessageBubble
const logger = createLogger('message-bubble');

interface MessageBubbleProps {
  message: Message;
  t: (key: string) => string;
  getContextTypeLabel: (type: ContextType) => string;
  renderMarkdown: (text: string) => { __html: string };
}

// Import or create QuoteIcon if not available
const QuoteIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M7.5 7h3.75m-3.75 3h3.75m3-6H18m-3.75 3H18m-3.75 3H18M4.5 19.5h15a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5h-15A1.5 1.5 0 0 0 3 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
  </svg>
);

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  t,
  getContextTypeLabel,
  renderMarkdown
}) => {
  const isUser = message.sender === 'user';
  const [isReferenceExpanded, setIsReferenceExpanded] = useState(true);
  const [isResponded, setIsResponded] = useState(false);
  
  // Log when system messages with confirmationData are rendered
  useEffect(() => {
    if (message.sender === 'system' && message.confirmationData) {
      logger.info(`Rendering system message with confirmation buttons: ${message.id}`);
      logger.info(`Confirmation data: ${JSON.stringify({
        type: message.confirmationData.type,
        tokens: message.confirmationData.estimatedTokens,
        chunks: message.confirmationData.estimatedChunks,
        hasApproveCallback: !!message.confirmationData.onApprove,
        hasCancelCallback: !!message.confirmationData.onCancel
      })}`);
    }
  }, [message]);
  
  // Toggle reference visibility
  const toggleReference = () => {
    setIsReferenceExpanded(!isReferenceExpanded);
  };
  
  // Handle confirmation approval
  const handleApprove = () => {
    if (message.confirmationData?.onApprove && !isResponded) {
      logger.info(`Approve button clicked for message: ${message.id}`);
      message.confirmationData.onApprove();
      setIsResponded(true);
    }
  };
  
  // Handle confirmation cancellation
  const handleCancel = () => {
    if (message.confirmationData?.onCancel && !isResponded) {
      logger.info(`Cancel button clicked for message: ${message.id}`);
      message.confirmationData.onCancel();
      setIsResponded(true);
    }
  };
  
  // Common prose and text styling classes
  const markdownClasses = "readlite-agent-markdown-content prose prose-xs max-w-none text-text-primary " +
    "prose-headings:text-text-primary prose-pre:bg-bg-primary/10 prose-pre:p-2 " +
    "prose-pre:rounded-md prose-pre:text-xs prose-code:text-xs prose-code:bg-bg-primary/10 " +
    "prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-a:text-accent " +
    "prose-a:no-underline hover:prose-a:underline text-base leading-relaxed " +
    "font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI','PingFang_SC','Hiragino_Sans_GB','Microsoft_YaHei',sans-serif] antialiased";
  
  // Should show reference block
  const shouldShowReference = 
    !isUser && 
    message.contextType === 'selection' && 
    message.reference && 
    message.reference.trim().length > 0;
  
  return (
    <div className={`flex py-1.5 ${isUser ? 'justify-end px-2.5' : 'justify-start pl-0 pr-4'}`}>
      <div className={`flex flex-col ${isUser ? 'items-end max-w-[85%]' : 'items-start max-w-[92%]'}`}>
        {/* System message with confirmation buttons */}
        {message.sender === 'system' && message.confirmationData ? (
          <div className="readlite-agent-message-content shadow-sm rounded-md p-4 
                         bg-bg-primary border-l-4 border-accent text-text-primary">
            <div className="flex items-center text-accent font-medium mb-3">
              <ExclamationCircleIcon className="w-5 h-5 mr-1.5 flex-shrink-0" />
              <span className="text-lg">{t('confirmationNeeded') || 'Confirmation Needed'}</span>
            </div>
            
            <div 
              className={markdownClasses}
              dangerouslySetInnerHTML={renderMarkdown(message.text)}
            />
            
            {message.confirmationData.type === 'article_size' && (
              <div className="mt-3 mb-4 p-2 bg-bg-secondary/30 rounded text-text-secondary text-sm">
                <div>
                  <span className="font-medium">Estimated size:</span> {message.confirmationData.estimatedTokens?.toLocaleString() || '?'} tokens
                </div>
                <div>
                  <span className="font-medium">Will be processed in:</span> {message.confirmationData.estimatedChunks || '?'} chunks
                </div>
              </div>
            )}
            
            {!isResponded ? (
              <div className="flex space-x-3 mt-4">
                <button 
                  onClick={handleApprove}
                  className="flex items-center px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 transition-colors"
                >
                  <CheckCircleIcon className="w-5 h-5 mr-1.5" />
                  <span>{t('approve') || 'Approve'}</span>
                </button>
                <button 
                  onClick={handleCancel}
                  className="flex items-center px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                >
                  <XCircleIcon className="w-5 h-5 mr-1.5" />
                  <span>{t('cancel') || 'Cancel'}</span>
                </button>
              </div>
            ) : (
              <div className="text-sm italic text-text-secondary mt-3">
                {t('responseProcessing') || 'Your response is being processed...'}
              </div>
            )}
          </div>
        ) : /* Special styling for old confirmation requests - keep for backwards compatibility */
        !isUser && message.isConfirmationRequest ? (
          <div className="readlite-agent-message-content shadow-sm rounded-[16px_16px_16px_4px] p-[10px_14px] 
                         bg-bg-primary border-2 border-accent/50 text-text-primary">
            <div className="flex items-center text-accent font-medium mb-2">
              <ExclamationCircleIcon className="w-4 h-4 mr-1.5" />
              <span>{t('confirmationNeeded') || 'Confirmation Needed'}</span>
            </div>
            
            <div 
              className={markdownClasses}
              dangerouslySetInnerHTML={renderMarkdown(message.text)}
            />
            
            <div className="mt-3 text-sm text-text-secondary">
              {t('replyWithYesOrNo') || 'Reply with "yes" to proceed or "no" to cancel.'}
            </div>
          </div>
        ) : !isUser && message.contextType ? (
          // Normal assistant message with context
          <div className={`readlite-agent-message-content shadow-sm rounded-[16px_16px_16px_4px] p-[10px_14px] 
                           bg-bg-agent text-text-agent border border-border`}>
            {/* Context badge integrated with message */}
            <div className="text-xs text-text-secondary flex items-center mb-1">
              <span>@</span>
              <span className="ml-0.5">{getContextTypeLabel(message.contextType)}</span>
            </div>
            
            {/* Reference block for selections */}
            {shouldShowReference && (
              <div className="mb-2">
                <div 
                  className="flex items-center text-xs text-text-secondary mb-1 cursor-pointer hover:text-accent"
                  onClick={toggleReference}
                >
                  <QuoteIcon className="w-3.5 h-3.5 mr-1" />
                  <span>{t('selectedText') || 'Selected Text'}</span>
                  {isReferenceExpanded ? 
                    <ChevronUpIcon className="w-3.5 h-3.5 ml-1" /> : 
                    <ChevronDownIcon className="w-3.5 h-3.5 ml-1" />
                  }
                </div>
                
                {isReferenceExpanded && (
                  <div className="pl-2 border-l-2 border-accent/30 py-1 pr-2 text-sm bg-bg-primary/5 rounded-r-md italic text-text-secondary/50 my-1">
                    {message.reference}
                  </div>
                )}
              </div>
            )}
            
            <div 
              className={markdownClasses}
              dangerouslySetInnerHTML={renderMarkdown(message.text)}
            />
          </div>
        ) : !isUser ? (
          // Regular assistant message without context
          <div className="readlite-agent-message-content shadow-sm rounded-[16px_16px_16px_4px] p-[10px_14px] 
                          bg-bg-agent text-text-agent border border-border">
            <div 
              className={markdownClasses}
              dangerouslySetInnerHTML={renderMarkdown(message.text)}
            />
          </div>
        ) : (
          // User message
          <div className={`readlite-agent-message-content shadow-sm rounded-[16px_16px_4px_16px] p-[10px_14px] 
                           bg-bg-user text-text-user ${markdownClasses}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble; 