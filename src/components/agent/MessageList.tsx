import React, { useRef, useEffect, useCallback } from 'react';
import { CommonProps, Message, ContextType } from '../../types/agent';
import MessageBubble from './MessageBubble';
import ThinkingIndicator from './ThinkingIndicator';
import { ChatBubbleOvalLeftIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

interface MessageListProps extends Pick<CommonProps, 't'> {
  messages: Message[];
  streamingResponse: string;
  isThinking: boolean;
  contextType: ContextType;
  error: string | null;
  getContextTypeLabel: (type: ContextType) => string;
  renderMarkdown: (text: string) => { __html: string };
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  retry: () => void;
  lastMessageRef?: React.RefObject<HTMLDivElement>;
}

const MessageList: React.FC<MessageListProps> = ({
  t,
  messages,
  streamingResponse,
  isThinking,
  contextType,
  error,
  getContextTypeLabel,
  renderMarkdown,
  isLoading,
  isError,
  errorMessage,
  retry,
  lastMessageRef
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Auto scroll to the bottom of the message list
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);
  
  // Auto scroll when messages update or there is streaming response
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingResponse, scrollToBottom]);
  
  // Smart grouping of messages for better visual continuity
  const getGroupedMessages = (messages: Message[]) => {
    const grouped: Message[][] = [];
    let currentGroup: Message[] = [];
    let currentSender = '';
    
    messages.forEach((message, index) => {
      // If it's a new sender or more than 5 minutes since the last message, create a new group
      if (message.sender !== currentSender || 
          (index > 0 && message.timestamp - messages[index-1].timestamp > 5 * 60 * 1000)) {
        if (currentGroup.length > 0) {
          grouped.push([...currentGroup]);
          currentGroup = [];
        }
        currentSender = message.sender;
      }
      
      currentGroup.push(message);
    });
    
    if (currentGroup.length > 0) {
      grouped.push(currentGroup);
    }
    
    return grouped;
  };
  
  // Get grouped messages
  const groupedMessages = getGroupedMessages(messages);

  // Common prose classes for markdown content
  const markdownClasses = "readlite-agent-markdown-content prose prose-xs max-w-none text-text-primary " +
    "prose-headings:text-text-primary prose-pre:bg-bg-primary/10 prose-pre:p-2 " +
    "prose-pre:rounded-md prose-pre:text-xs prose-code:text-xs prose-code:bg-bg-primary/10 " +
    "prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-a:text-accent " +
    "prose-a:no-underline hover:prose-a:underline text-base leading-relaxed " +
    "font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI','PingFang_SC','Hiragino_Sans_GB','Microsoft_YaHei',sans-serif] " +
    "antialiased"; 

  // Common system font stack class
  const systemFontClass = "font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI','PingFang_SC','Hiragino_Sans_GB','Microsoft_YaHei',sans-serif] antialiased";

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin 
                scrollbar-thumb-[var(--readlite-scrollbar-thumb)] scrollbar-track-transparent scroll-pt-4"
      style={{ overscrollBehavior: 'contain' }}
    >
      {messages.length === 0 && !streamingResponse && !isThinking && !error && !isLoading && !isError ? (
        <div className={`flex flex-col items-center justify-center h-full text-center p-6 ${systemFontClass}`}>
          <div className="mb-4 text-text-secondary/30">
            <ChatBubbleOvalLeftIcon className="w-16 h-16" />
          </div>
          <div className="text-base font-medium text-text-primary">
            {t('startConversation') || 'Start a new conversation'}
          </div>
          <p className="text-base text-text-secondary mt-2 max-w-xs leading-relaxed">
            {t('emptyStateDescription') || 'Select a context mode and ask any question to start the conversation.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Display message groups */}
          {groupedMessages.map((group, groupIndex) => (
            <div key={`group-${groupIndex}`} className="space-y-1">
              {group.map((message, index) => (
                <div 
                  key={message.id || `${groupIndex}-${index}`} 
                  ref={index === group.length - 1 && groupIndex === groupedMessages.length - 1 && lastMessageRef ? lastMessageRef : null}
                >
                  <MessageBubble
                    t={t}
                    message={message}
                    getContextTypeLabel={getContextTypeLabel}
                    renderMarkdown={renderMarkdown}
                  />
                </div>
              ))}
            </div>
          ))}
          
          {/* Streaming response message */}
          {streamingResponse && (
            <div className="flex flex-col items-start pl-0 pr-4 py-1.5 mb-1.5">
              <div className="shadow-sm rounded-[16px_16px_16px_4px] p-[10px_14px] 
                            bg-bg-agent text-text-agent border border-border relative max-w-[92%] transition-all">
                <div className="text-xs text-text-secondary flex items-center mb-1">
                  <span>@</span>
                  <span className="ml-0.5">{getContextTypeLabel(contextType)}</span>
                </div>
                
                {/* Reference block for selections in streaming response */}
                {contextType === 'selection' && messages.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center text-xs text-text-secondary mb-1">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 mr-1">
                        <path d="M7.5 7h3.75m-3.75 3h3.75m3-6H18m-3.75 3H18m-3.75 3H18M4.5 19.5h15a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5h-15A1.5 1.5 0 0 0 3 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
                      </svg>
                      <span>{t('selectedText') || 'Selected Text'}</span>
                    </div>
                    <div className="pl-2 border-l-2 border-accent/30 py-1 pr-2 text-sm bg-bg-primary/5 rounded-r-md italic text-text-secondary/50 my-1">
                      {messages.length > 0 && messages[messages.length-1].sender === 'user' ? messages[messages.length-1].text : ''}
                    </div>
                  </div>
                )}
                
                {/* Streaming response content */}
                <div
                  className={markdownClasses}
                  dangerouslySetInnerHTML={renderMarkdown(streamingResponse)}
                />
                {isThinking && (
                  <span className="inline-block w-0.5 h-4 bg-text-secondary/50 ml-0.5 align-text-bottom animate-blink"></span>
                )}
              </div>
            </div>
          )}
          
          {/* Thinking indicator */}
          {isThinking && !streamingResponse && (
            <ThinkingIndicator t={t} />
          )}
          
          {/* Error message */}
          {isError && (
            <div className="flex flex-col items-start px-2.5 py-1.5">
              <div className={`bg-bg-primary text-error px-4 py-3 rounded-2xl text-base max-w-[92%] 
                             shadow-sm ring-1 ring-error/20 backdrop-blur-[2px] ${systemFontClass}`}>
                <div className="font-medium mb-2 flex items-center">
                  <ExclamationCircleIcon className="w-4 h-4 mr-1.5" />
                  {t('errorOccurred') || 'An error occurred'}
                </div>
                <div className="text-sm text-text-secondary leading-relaxed">
                  {errorMessage || (t('errorMessage') || 'Unable to complete the request. Please try again later.')}
                </div>
                <button 
                  onClick={retry}
                  className="mt-3 text-sm bg-accent/10 text-accent px-3 py-1 rounded-full hover:bg-accent/15 transition-colors font-medium"
                >
                  {t('retry') || 'Retry'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Reference element for auto-scrolling to bottom */}
      <div ref={messagesEndRef} className="h-px" />
    </div>
  );
};

export default MessageList; 