/**
 * Agent Service interfaces for intelligent reader interaction
 * Defines the agent capabilities and command processing
 */

import { ReaderAPI } from "./reader";

// Command components
export interface ParsedCommand {
  command: string;
  args: string[];
  originalText: string;
}

// Intent detection result
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

// Agent response format
export interface AgentResponse {
  type: "text" | "action" | "error";
  content: string;
  actions?: ReaderAction[];
  metadata?: Record<string, any>;
}

// Reader action to be executed
export interface ReaderAction {
  type: keyof ReaderAPI;
  params: any[];
}

/**
 * Agent Command Handler interface
 * Specific handlers for different command types
 */
export interface CommandHandler {
  canHandle(command: string): boolean;
  execute(command: ParsedCommand, readerApi: ReaderAPI): Promise<AgentResponse>;
}

/**
 * Agent Service Interface
 * Core agent functionality for processing commands and controlling the reader
 */
export interface AgentService {
  // Process user input - main entry point
  processCommand(input: string, readerApi: ReaderAPI): Promise<AgentResponse>;

  // Command detection and parsing
  isCommandSyntax(input: string): boolean;
  parseCommand(input: string): ParsedCommand;

  // Natural language understanding
  detectIntent(input: string): Promise<DetectedIntent>;

  // Reader API access
  executeReaderAction(
    action: ReaderAction,
    readerApi: ReaderAPI,
  ): Promise<void>;

  // Register command handlers
  registerCommandHandler(handler: CommandHandler): void;
}
