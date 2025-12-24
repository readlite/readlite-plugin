import { Model } from './api';
import { ReaderAPI } from './reader';

// --- Chat & UI Types ---

export interface AgentUIProps {
  onClose?: () => void;
  isVisible: boolean;
  initialMessage?: string;
  article?: any;
  visibleContent?: string;
  baseFontSize: number;
  baseFontFamily: string;
  useStyleIsolation?: boolean;
}

export interface CommonProps {
  t: (key: string) => string;
}

export type ContextType = 'screen' | 'article' | 'selection';

export interface Message {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: number;
  thinking?: boolean;
  error?: boolean;
  contextType?: ContextType;
  reference?: string;
  isConfirmationRequest?: boolean;
  confirmationData?: ConfirmationData;
}

export interface ConfirmationData {
  type: 'article_size';
  estimatedTokens?: number;
  estimatedChunks?: number;
  onApprove?: () => void;
  onCancel?: () => void;
}

// --- LLM & API Types ---

export interface ModelSettings {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// --- Legacy / Command Types (Preserved for compatibility if needed) ---

export interface ParsedCommand {
  command: string;
  args: string[];
  originalText: string;
}

export interface DetectedIntent {
  intent: string;
  confidence: number;
  entities: {
    type: string;
    value: string;
  }[];
  action?: string;
  parameters?: Record<string, any>;
}

export interface AgentResponse {
  type: 'text' | 'action' | 'error';
  content: string;
  actions?: ReaderAction[];
  metadata?: Record<string, any>;
}

export interface ReaderAction {
  type: keyof ReaderAPI;
  params: any[];
}

export interface CommandHandler {
  canHandle(command: string): boolean;
  execute(command: ParsedCommand, readerApi: ReaderAPI): Promise<AgentResponse>;
}

export interface AgentService {
  processCommand(input: string, readerApi: ReaderAPI): Promise<AgentResponse>;
  isCommandSyntax(input: string): boolean;
  parseCommand(input: string): ParsedCommand;
  detectIntent(input: string): Promise<DetectedIntent>;
  executeReaderAction(action: ReaderAction, readerApi: ReaderAPI): Promise<void>;
  registerCommandHandler(handler: CommandHandler): void;
}