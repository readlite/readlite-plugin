// New Agent Context System - Selection-First Lens Paradigm
// Export all components for the new system

export { default as AgentUI } from './AgentUI';
export { default as InlineAnswerCard } from './InlineAnswerCard';
export { SentenceSegmenter } from './SentenceSegmenter';
export { ContextPackBuilder } from './ContextPackBuilder';
export { SelectionManager } from './SelectionManager';
export { ConversationManager } from './ConversationManager';

// Legacy components (kept for compatibility)
export { default as MessageList } from './MessageList';
export { default as InputArea } from './InputArea';
export { default as LoginPrompt } from './LoginPrompt';
export { default as MessageBubble } from './MessageBubble';
export { default as ThinkingIndicator } from './ThinkingIndicator';

// Types
export * from './types'; 