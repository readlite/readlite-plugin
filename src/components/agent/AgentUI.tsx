import React, { useState, useRef, useEffect, useCallback } from "react";
import { useI18n } from "~/context/I18nContext";
import { marked } from "marked";
import { Model } from "../../types/api";
import { isAuthenticated, openAuthPage } from "../../utils/auth";
import { Message, ContextType } from "./types";
import { StyleIsolator } from "../../content";
import { useTheme } from "../../context/ThemeContext";
import { createLogger } from "../../utils/logger";
import LoginPrompt from "./LoginPrompt";
import MessageList from "./MessageList";
import InputArea from "./InputArea";
import ConversationManager from "./ConversationManager";
import aiClient from "./AIClient";
// Removed unused imports: ExclamationCircleIcon, CheckIcon, XMarkIcon

// Create a logger instance for the agent component
const logger = createLogger("agent");

// Get summary instructions for the LLM
const getSummaryInstructions = (): string => {
  return `You are an assistant that helps users understand content currently visible on their screen. Your responses should:

1. Focus primarily on the content that is currently visible in the user's viewport
2. Provide explanations, summaries, or answer questions about the visible text
3. Be clear and concise, with accurate information
4. Acknowledge when you don't have enough context (if the visible content is incomplete)
5. Adapt to the user's questions - they might ask about what they're currently reading

When responding to questions about what's visible:
- Prioritize the visible content over other context
- Be helpful even if only partial information is available
- If the user asks about something not in view, suggest they scroll to relevant sections

Respond directly to queries without meta-commentary like "Based on the visible content..."`;
};

declare global {
  interface Window {
    _readliteIframeElement?: HTMLIFrameElement | null;
  }
}

// Define component props
interface AgentUIProps {
  onClose?: () => void;
  isVisible: boolean;
  initialMessage?: string;
  article?: any; // Optional article context to use for the AI
  visibleContent?: string; // New prop for the content currently visible on screen
  baseFontSize: number; // New prop for base font size from reader
  baseFontFamily: string; // New prop for base font family from reader
  useStyleIsolation?: boolean; // New option to use Shadow DOM isolation
}

/**
 * Modern AgentUI component combining ReadLite, Cursor, and Claude UX elements
 * Optimized for token efficiency and mobile-friendly design
 */
export const AgentUI: React.FC<AgentUIProps> = ({
  onClose,
  isVisible,
  initialMessage,
  article,
  visibleContent, // New prop for visible content
  baseFontSize, // Receive new prop
  baseFontFamily, // Receive new prop
  useStyleIsolation = true, // Default to true for style isolation
}) => {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState("");
  const [contextType, setContextType] = useState<ContextType>("screen"); // Default to screen context
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(true); // Initialize to true
  // New state for selected text
  const [selectedText, setSelectedText] = useState<string>("");
  // Add a state to track the last failed message for retry
  const [lastFailedMessage, setLastFailedMessage] = useState<string>("");

  // Track if we're processing a large article
  const isProcessingLargeArticle = useRef<boolean>(false);

  // Authentication state
  const [isAuth, setIsAuth] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  // State to hold the dynamically loaded models
  const [modelsList, setModelsList] = useState<Model[]>([]);

  // Refs
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Initialize conversation manager
  const conversationManagerRef = useRef<ConversationManager>(
    new ConversationManager(getSummaryInstructions()),
  );

  // Hooks
  const { t } = useI18n();
  const { theme } = useTheme();

  // Check initial authentication status when the component mounts
  useEffect(() => {
    const checkInitialAuth = async () => {
      try {
        logger.info("Checking initial authentication status");
        const authStatus = await isAuthenticated();
        logger.info("Initial auth status:", authStatus);
        setIsAuth(authStatus);
        setIsAuthLoading(false);
        setShowLoginPrompt(!authStatus);
      } catch (error) {
        logger.error("Error checking authentication:", error);
        setIsAuth(false);
        setIsAuthLoading(false);
        setShowLoginPrompt(true);
      }
    };

    checkInitialAuth();
  }, []);

  // Define context options after t is declared
  const contextOptions = [
    {
      value: "screen" as ContextType,
      label: t("contextTypeScreen") || "Screen",
    },
    {
      value: "article" as ContextType,
      label: t("contextTypeArticle") || "Article",
    },
    {
      value: "selection" as ContextType,
      label: t("contextTypeSelection") || "Selection",
    },
  ];

  // Request models from background script on mount and load selected model from localStorage
  useEffect(() => {
    // Try to load previously selected model from localStorage
    try {
      const savedModelId = localStorage.getItem("readlite_selected_model");
      if (savedModelId && modelsList.length > 0) {
        // Find model object that matches the saved model ID
        const matchedModel = modelsList.find(
          (model) => model.value === savedModelId,
        );
        if (matchedModel) {
          logger.info(`Loaded saved model from localStorage: ${savedModelId}`);
          setSelectedModel(matchedModel);
        }
      }
    } catch (error) {
      logger.error("Error loading saved model:", error);
    }

    // Fetch available models list from background script
    const loadModels = (attempt = 1, maxAttempts = 3, delay = 2000) => {
      logger.info(`Loading models (attempt ${attempt}/${maxAttempts})`);

      chrome.runtime.sendMessage(
        {
          type: "GET_MODELS_REQUEST",
          // Force refresh on retry attempts
          forceRefresh: attempt > 1,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            logger.error("Error requesting models:", chrome.runtime.lastError);
            retryIfNeeded(attempt, maxAttempts, delay);
            return;
          }

          if (response && response.success && Array.isArray(response.data)) {
            logger.info(
              `Received models list (${response.data.length} models, fromCache: ${response.fromCache}):`,
              response.data,
            );

            // If we got an empty list and we're authenticated, retry
            if (response.data.length === 0 && isAuth && attempt < maxAttempts) {
              logger.info(
                `Empty models list while authenticated, will retry in ${delay}ms`,
              );
              retryIfNeeded(attempt, maxAttempts, delay);
              return;
            }

            setModelsList(response.data);

            // Ensure selected model is available in the list, otherwise use default
            if (response.data.length > 0) {
              const currentDefault = response.data[0].value; // Only store ID
              const savedModelId = localStorage.getItem(
                "readlite_selected_model",
              );

              if (
                savedModelId &&
                !response.data.some((m: Model) => m.value === savedModelId)
              ) {
                logger.info(
                  `Selected model ${savedModelId} not found in list, using default: ${currentDefault}`,
                );
                const defaultModel = response.data[0];
                setSelectedModel(defaultModel);
                localStorage.setItem(
                  "readlite_selected_model",
                  defaultModel.value,
                ); // Only store ID
              }
            } else {
              // Handle case when no models are available
              logger.warn("No models available from API");
              setSelectedModel(null);
            }
          } else {
            logger.error(
              "Failed to get models from background or invalid format:",
              response,
            );
            retryIfNeeded(attempt, maxAttempts, delay);
          }
        },
      );
    };

    // Helper function to retry loading models if needed
    const retryIfNeeded = (
      attempt: number,
      maxAttempts: number,
      delay: number,
    ) => {
      if (attempt < maxAttempts) {
        logger.info(
          `Will retry loading models in ${delay}ms (attempt ${attempt}/${maxAttempts})`,
        );
        setTimeout(() => {
          loadModels(attempt + 1, maxAttempts, delay);
        }, delay);
      }
    };

    loadModels();
  }, []);

  // Use useEffect to set default model when modelsList changes and selectedModel is null
  useEffect(() => {
    if (modelsList.length > 0 && selectedModel === null) {
      const savedModelId = localStorage.getItem("readlite_selected_model");

      if (savedModelId) {
        // Try to find the saved model in our list
        const matchedModel = modelsList.find(
          (model) => model.value === savedModelId,
        );
        if (matchedModel) {
          logger.info(
            `Using saved model from localStorage: ${matchedModel.label}`,
          );
          setSelectedModel(matchedModel);
          return;
        }
      }

      // If no saved model or saved model not found, use the first model as default
      logger.info(`Using default model: ${modelsList[0].label}`);
      setSelectedModel(modelsList[0]);
    }
  }, [modelsList, selectedModel]);

  // Set initial agent message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage =
        initialMessage ||
        t("welcomeMessage") ||
        "I'm here to help you understand what's currently visible on your screen.";
      setMessages([
        {
          id: "welcome",
          sender: "agent",
          text: welcomeMessage,
          timestamp: Date.now(),
          contextType: "screen", // Default to screen context
        },
      ]);

      // Add welcome message to conversation manager
      conversationManagerRef.current.addAssistantMessage(welcomeMessage);
    }
  }, [initialMessage, t]);

  // Auto focus input when component becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isVisible]);

  // Cleanup event listeners when component unmounts
  useEffect(() => {
    return () => {
      aiClient.cleanupStreamListeners();
      // Reset large article processing flag when done
      isProcessingLargeArticle.current = false;
      // Also reset the conversation manager confirmation state
      conversationManagerRef.current.resetConfirmationState();
    };
  }, []);

  // Render markdown function
  const renderMarkdown = (text: string) => {
    try {
      // Use marked to convert markdown to HTML
      const htmlContent = marked.parse(text, { breaks: true }) as string;
      return { __html: htmlContent };
    } catch (error) {
      logger.error("Error rendering markdown:", error);
      return { __html: text };
    }
  };

  // Get context label
  const getContextTypeLabel = (type: ContextType): string => {
    switch (type) {
      case "screen":
        return t("contextTypeScreen") || "Screen";
      case "article":
        return t("contextTypeArticle") || "Article";
      case "selection":
        return t("contextTypeSelection") || "Selection";
      default:
        return type;
    }
  };

  // Add wrapper function to reconcile the type mismatch
  const handleSetContextType = (type: ContextType | null) => {
    if (type !== null) {
      setContextType(type);
    }
  };

  // Listen for model changes and save to localStorage
  useEffect(() => {
    if (selectedModel) {
      try {
        localStorage.setItem("readlite_selected_model", selectedModel.value);
        logger.info(
          `Saved selected model to localStorage: ${selectedModel.label}`,
        );
      } catch (error) {
        logger.error("Error saving model to localStorage:", error);
      }
    }
  }, [selectedModel]);

  // simplify the handleArticleContext function
  const handleArticleContext = (
    articleContent: string,
    title?: string,
    url?: string,
    language?: string,
  ): boolean => {
    conversationManagerRef.current.setContext(
      "article",
      articleContent,
      title || "Untitled",
      url,
      language,
    );

    logger.info(`Set article context with title: ${title || "Untitled"}`);

    return false;
  };

  const processUserMessage = useCallback(async () => {
    // Set loading state
    setIsLoading(true);
    setError(null);
    setIsThinking(true);
    setStreamingResponse("");

    // Track if using selection context
    const isUsingSelection = contextType === "selection" && selectedText;
    const referenceText = isUsingSelection ? selectedText : "";

    // Check if context is available
    const hasContext = conversationManagerRef.current.hasContext();

    // If context is missing, show an error
    if (!hasContext) {
      let errorMessage = "No content available.";
      if (contextType === "screen") {
        errorMessage =
          "No content visible on screen. Please scroll to view some content and try again.";
      } else if (contextType === "article") {
        errorMessage =
          "No article content available. Please try a different article.";
      } else if (contextType === "selection") {
        errorMessage =
          "No text selection available. Please select some text and try again.";
      }
      setError(errorMessage);
      setIsLoading(false);
      setIsThinking(false);
      return;
    }

    // Use a local variable to accumulate the complete response
    let accumulatedResponse = "";

    try {
      // Get prompt from conversation manager
      const messages = conversationManagerRef.current.buildPrompt();

      // Use appropriate model settings for API call
      const modelSettings = getModelSettings();

      // Use streaming API for more responsive experience
      await aiClient.generateTextStream(
        messages,
        (chunk: string) => {
          accumulatedResponse += chunk;
          setStreamingResponse((prev) => prev + chunk);
        },
        modelSettings,
      );

      const agentMessage: Message = {
        id: `agent-${Date.now()}`,
        sender: "agent",
        text:
          accumulatedResponse ||
          "I couldn't generate a response. Please try again.",
        timestamp: Date.now(),
        contextType, // Track which context was used
        // Add reference text if using selection context
        reference: isUsingSelection ? referenceText : undefined,
      };

      // Add agent response to conversation UI
      setMessages((prev) => [...prev, agentMessage]);

      // Add agent response to conversation manager
      conversationManagerRef.current.addAssistantMessage(agentMessage.text);

      // Reset streaming response
      setStreamingResponse("");
    } catch (err) {
      logger.error("Error calling LLM API:", err);

      // Store the failed message for retry
      if (inputText.trim() && !lastFailedMessage) {
        setLastFailedMessage(inputText.trim());
      }

      // Special handling for auth errors - suggest logging in again
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred while generating a response";
      if (
        errorMessage.includes("401") ||
        errorMessage.includes("auth") ||
        errorMessage.includes("unauthorized")
      ) {
        setError(
          "Authentication error. Please log in again to continue using the AI assistant.",
        );
        setIsAuth(false);
      } else {
        setError(errorMessage);
      }

      // If we have partial response but encountered an error, still show it
      if (accumulatedResponse) {
        const errorMessage: Message = {
          id: `agent-${Date.now()}`,
          sender: "agent",
          text:
            accumulatedResponse +
            "\n\n_(Response may be incomplete due to an error)_",
          timestamp: Date.now(),
          error: true,
          contextType,
          // Add reference text if using selection context
          reference: isUsingSelection ? referenceText : undefined,
        };

        setMessages((prev) => [...prev, errorMessage]);

        // Also add to conversation manager
        conversationManagerRef.current.addAssistantMessage(errorMessage.text);
      }
    } finally {
      setIsLoading(false);
      setIsThinking(false);
      // Reset large article processing flag when done
      isProcessingLargeArticle.current = false;
    }
  }, [contextType, selectedText, inputText, lastFailedMessage, article]);

  // 简化handleSendMessage函数
  const handleSendMessage = useCallback(async () => {
    if ((!inputText.trim() && !lastFailedMessage) || isLoading) return;

    // Check if user is authenticated
    if (!isAuth) {
      setError("Please log in to use the AI assistant feature.");
      return;
    }

    // Use either the input text or the last failed message for retry
    const userInput = inputText.trim() || lastFailedMessage;

    // Reset the last failed message when submitting a new message
    if (inputText.trim()) {
      setLastFailedMessage("");
    }

    // Check for @command syntax (@article, @screen, @selection)
    const commandMatch = userInput.match(/^@(\w+)(?:\s+(.*))?$/);
    if (commandMatch) {
      const command = commandMatch[1].toLowerCase();
      const remainingText = commandMatch[2] || "";
      let isCommandHandled = false;

      // Handle simple context switching commands
      if (["screen", "article", "selection"].includes(command)) {
        const newContextType = command as ContextType;

        // Check context-specific requirements
        if (newContextType === "screen" && !visibleContent) {
          setError(
            "No content visible on screen. Please scroll to view some content.",
          );
          return;
        } else if (newContextType === "article" && !article?.content) {
          setError("No article content available.");
          return;
        } else if (newContextType === "selection" && !selectedText) {
          setError(
            "No text selection available. Please select some text first.",
          );
          return;
        }

        // Update context type
        setContextType(newContextType);

        // Create command acknowledgment message for the UI
        const commandMessage: Message = {
          id: `user-${Date.now()}`,
          sender: "user",
          text: userInput,
          timestamp: Date.now(),
          contextType: newContextType,
        };

        // Add system response confirming the context change
        const contextName = getContextTypeLabel(newContextType);
        const responseMessage: Message = {
          id: `system-${Date.now()}`,
          sender: "agent",
          text: `Switched to ${contextName} context. ${remainingText ? 'Processing your query: "' + remainingText + '"' : ""}`,
          timestamp: Date.now(),
          contextType: newContextType,
        };

        // Update UI with both messages
        setMessages((prev) => [...prev, commandMessage, responseMessage]);

        // If there's remaining text, process it as a query
        if (remainingText) {
          // Set inputText to the remainingText and trigger handleSendMessage again
          setInputText(remainingText);
          setTimeout(() => handleSendMessage(), 100);
        } else {
          setInputText("");
        }

        isCommandHandled = true;
      }

      // If command was handled, exit the function
      if (isCommandHandled) {
        return;
      }
    }

    // Continue with normal message processing for non-command or unrecognized commands

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: userInput,
      timestamp: Date.now(),
      contextType, // Store which context type was used
    };

    // Add user message to conversation UI
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");

    // Add user message to conversation manager
    conversationManagerRef.current.addUserMessage(userInput);

    // Reset height of textarea
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    // 根据当前上下文类型设置上下文
    if (contextType === "article" && article?.content) {
      // 使用简化的文章处理函数，直接设置上下文
      handleArticleContext(
        article.content,
        article.title || "Untitled",
        article.url,
        article.language,
      );
    } else if (contextType === "screen" && visibleContent) {
      // 设置屏幕内容上下文
      conversationManagerRef.current.setContext(
        "screen",
        visibleContent,
        article?.title || "Current View",
        article?.url,
        article?.language,
      );
    } else if (contextType === "selection" && selectedText) {
      // 设置选中文本上下文
      conversationManagerRef.current.setContext(
        "selection",
        selectedText,
        "Selected Text",
      );
    }

    // 立即处理用户消息，不检查确认状态
    processUserMessage();
  }, [
    inputText,
    isLoading,
    article,
    visibleContent,
    contextType,
    isAuth,
    selectedText,
    lastFailedMessage,
    processUserMessage,
  ]);

  // Monitor for authentication status changes via runtime messages
  useEffect(() => {
    const authChangeListener = (message: any) => {
      if (
        message.type === "AUTH_STATUS_CHANGED" &&
        message.isAuthenticated !== undefined
      ) {
        logger.info("Authentication status changed:", message.isAuthenticated);

        // Update auth state
        setIsAuth(message.isAuthenticated);
        setIsAuthLoading(false);
        setShowLoginPrompt(!message.isAuthenticated);

        // When authenticated, refresh the models list
        if (message.isAuthenticated) {
          refreshModelsList(true);
        }
      }
    };

    // Add listener
    chrome.runtime.onMessage.addListener(authChangeListener);

    // Cleanup
    return () => {
      chrome.runtime.onMessage.removeListener(authChangeListener);
    };
  }, []);

  // Refresh models list
  const refreshModelsList = useCallback(
    (forceRefresh = false) => {
      logger.info(`Refreshing models list${forceRefresh ? " (forced)" : ""}`);
      chrome.runtime.sendMessage(
        {
          type: "GET_MODELS_REQUEST",
          forceRefresh,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            logger.error("Error requesting models:", chrome.runtime.lastError);
            return;
          }

          if (response && response.success && Array.isArray(response.data)) {
            logger.info(
              `Received models (${response.data.length} models):`,
              response.data,
            );
            setModelsList(response.data);

            // Set default model if needed
            if (
              response.data.length > 0 &&
              (!selectedModel ||
                !response.data.some(
                  (m: Model) => m.value === selectedModel.value,
                ))
            ) {
              logger.info(`Setting default model: ${response.data[0].label}`);
              setSelectedModel(response.data[0]);
              localStorage.setItem(
                "readlite_selected_model",
                response.data[0].value,
              );
            }
          }
        },
      );
    },
    [selectedModel],
  );

  // Trigger authentication flow - simple version
  const handleLogin = () => {
    setError(null);
    setIsAuthLoading(true);
    logger.info("Starting authentication flow");
    openAuthPage();
  };

  // Use appropriate model settings for API call
  const getModelSettings = () => {
    // If we have a selected model, use it
    if (selectedModel) {
      return {
        model: selectedModel.value,
        temperature: 0.7,
        maxTokens: Math.floor(selectedModel.contextWindow * 0.8), // Use 80% of the context window
      };
    }

    // If no selected model but we have models available, use the first one
    if (modelsList.length > 0) {
      return {
        model: modelsList[0].value,
        temperature: 0.7,
        maxTokens: Math.floor(modelsList[0].contextWindow * 0.8), // Use 80% of the context window
      };
    }

    // Fallback - should rarely happen
    return {
      temperature: 0.7,
      maxTokens: 3200, // 80% of 4000
    };
  };

  // Listen for selection message from the reader
  useEffect(() => {
    const handleSelectionMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "ASK_AI_WITH_SELECTION") {
        // Set the selected text
        const text = event.data.selectedText;
        if (text && typeof text === "string") {
          setSelectedText(text);
          // Set context type to selection
          setContextType("selection");

          // Optional: Automatically set a query about the selection
          setInputText(`${t("explainSelection") || "Explain this text"}`);

          // Scroll to input
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }
      }
    };

    window.addEventListener("message", handleSelectionMessage);

    return () => {
      window.removeEventListener("message", handleSelectionMessage);
    };
  }, [t]);

  // 简化上下文更新的useEffect
  useEffect(() => {
    // 不处理大文章确认，直接设置上下文
    if (contextType === "screen" && visibleContent) {
      conversationManagerRef.current.setContext(
        "screen",
        visibleContent,
        article?.title || "Current View",
        article?.url,
        article?.language,
      );
    } else if (contextType === "article" && article?.content) {
      // 直接设置文章上下文
      conversationManagerRef.current.setContext(
        "article",
        article.content,
        article.title || "Untitled",
        article.url,
        article.language,
      );
    } else if (contextType === "selection" && selectedText) {
      conversationManagerRef.current.setContext(
        "selection",
        selectedText,
        "Selected Text",
      );
    }
  }, [contextType, visibleContent, article, selectedText]);

  // Update the clear conversation function to also reset the confirmation flag
  const handleClearConversation = useCallback(() => {
    // Clear UI messages but keep welcome message
    const welcomeMessage = messages.find((msg) => msg.id === "welcome");
    setMessages(welcomeMessage ? [welcomeMessage] : []);

    // Clear conversation manager
    conversationManagerRef.current.clearConversation();

    // Re-add welcome message to conversation manager if it exists
    if (welcomeMessage) {
      conversationManagerRef.current.addAssistantMessage(welcomeMessage.text);
    }

    // Reset large article processing flag
    isProcessingLargeArticle.current = false;
  }, [messages]);

  // New method specifically for retrying a failed message
  const handleRetry = useCallback(() => {
    // If we have a last failed message, we'll use that
    if (lastFailedMessage) {
      // Call handleSendMessage which will use lastFailedMessage since inputText is empty
      handleSendMessage();
    } else if (messages.length > 0) {
      // Find the last user message if there's no specific failed message
      const lastUserMsg = [...messages]
        .reverse()
        .find((msg) => msg.sender === "user");
      if (lastUserMsg) {
        setLastFailedMessage(lastUserMsg.text);
        // Delay slightly to ensure state update before calling handleSendMessage
        setTimeout(() => handleSendMessage(), 10);
      }
    }
  }, [lastFailedMessage, messages, handleSendMessage]);

  // Render the AgentUI component
  const agentContent = (
    <div
      className="readlite-agent-container readlite-scope flex flex-col w-full h-full bg-bg-secondary text-text-primary relative"
      style={{
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        fontSize: `${baseFontSize}px`,
        fontFamily:
          baseFontFamily ||
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Show LoginPrompt if showLoginPrompt is true */}
      {isAuthLoading ? (
        // Show loading indicator while checking auth status
        <div className="flex justify-center items-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Checking authentication status...</p>
          </div>
        </div>
      ) : showLoginPrompt ? (
        <LoginPrompt onLogin={handleLogin} t={t} />
      ) : !isAuth ? (
        // If login attempted but failed or user logged out, show prompt again
        <LoginPrompt
          onLogin={handleLogin}
          t={t}
          error={error || "Login required or failed. Please try again."}
        />
      ) : (
        <>
          {/* Main messages container */}
          <div
            ref={messagesContainerRef}
            className="flex-grow overflow-y-auto pt-2 px-4 pb-4 bg-bg-secondary"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: `var(--readlite-scrollbar-thumb) var(--readlite-scrollbar-track)`,
            }}
          >
            <MessageList
              t={t}
              messages={messages}
              isThinking={isThinking}
              streamingResponse={streamingResponse}
              contextType={contextType}
              error={error}
              getContextTypeLabel={getContextTypeLabel}
              renderMarkdown={renderMarkdown}
              isLoading={isLoading}
              isError={!!error}
              errorMessage={error}
              retry={handleRetry}
            />
          </div>

          {/* Input area - now includes close button and toolbar controls */}
          <InputArea
            t={t}
            inputText={inputText}
            setInputText={setInputText}
            isLoading={isLoading || isThinking}
            isProcessing={isProcessing}
            onSendMessage={handleSendMessage}
            disableSend={isLoading || inputText.trim() === ""}
            contextType={contextType}
            setContextType={handleSetContextType}
            contextOptions={contextOptions}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            availableModels={modelsList}
            isAuth={isAuth}
            onClearConversation={handleClearConversation}
            onLogin={handleLogin}
            onClose={onClose}
            selectedText={selectedText}
          />
        </>
      )}
    </div>
  );

  // Return the component, wrapped in StyleIsolator if requested
  return useStyleIsolation ? (
    <StyleIsolator fitContent={true} theme={theme}>
      {agentContent}
    </StyleIsolator>
  ) : (
    agentContent
  );
};

export default AgentUI;
