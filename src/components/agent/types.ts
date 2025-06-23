import { Model } from '../../types/api';

// Update CommonProps to only include translation function
export interface CommonProps {
  t: (key: string) => string;
}

// Message interface
export interface Message {
  id: string;
  sender: 'user' | 'agent' | 'system'; // Add 'system' type for special messages
  text: string;
  timestamp: number;
  thinking?: boolean;
  error?: boolean;
  contextType?: ContextType; // Track which context was used
  reference?: string; // Store reference text for quotes/selections
  isConfirmationRequest?: boolean; // Flag for large article confirmation prompts
  confirmationData?: ConfirmationData; // Data for confirmation requests
}

// Confirmation data for system messages
export interface ConfirmationData {
  type: 'article_size'; // Type of confirmation
  estimatedTokens?: number; // Estimated token count
  estimatedChunks?: number; // Estimated chunks needed
  onApprove?: () => void; // Function to call when approved
  onCancel?: () => void; // Function to call when canceled
}

// Available context types
export type ContextType = 'screen' | 'article' | 'selection';

// Re-export Model type for convenience
export type { Model }; 