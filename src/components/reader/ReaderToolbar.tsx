import React, { useEffect } from "react";
import {
  ChatBubbleLeftRightIcon,
  ArrowDownTrayIcon,
  Cog6ToothIcon,
  XMarkIcon,
  PlayIcon,
  PauseIcon,
  LanguageIcon,
} from "@heroicons/react/24/outline";
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
} from "@heroicons/react/24/outline";

interface ReaderToolbarProps {
  showAgent: boolean;
  leftPanelWidth: number;
  toggleAgent: () => void;
  handleMarkdownDownload: () => void;
  toggleSettings: () => void;
  handleClose: () => void;
  toggleFullscreen: () => void;
  isFullscreen: boolean;
  settingsButtonRef: React.RefObject<HTMLButtonElement>;
  showSettings: boolean;
  isDragging?: boolean;
  t: (key: string) => string;
  isAutoScrolling: boolean;
  toggleAutoScroll: () => void;
  translateArticle?: () => void;
  isTranslating?: boolean;
}

/**
 * Toolbar component with control buttons for the reader
 */
const ReaderToolbar: React.FC<ReaderToolbarProps> = ({
  showAgent,
  leftPanelWidth,
  toggleAgent,
  handleMarkdownDownload,
  toggleSettings,
  handleClose,
  toggleFullscreen,
  isFullscreen,
  settingsButtonRef,
  showSettings,
  isDragging = false,
  t,
  isAutoScrolling = false,
  toggleAutoScroll,
  translateArticle,
  isTranslating = false,
}) => {
  // Calculate right position based on panel width
  const rightPosition = showAgent
    ? `calc(${100 - leftPanelWidth}% + 20px)`
    : "20px";

  // Track previous showAgent state to handle animation properly
  const [isAnimating, setIsAnimating] = React.useState(false);
  const prevShowAgentRef = React.useRef(showAgent);

  // Handle animation when Agent panel is toggled
  useEffect(() => {
    if (prevShowAgentRef.current !== showAgent) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 200); // Match this with the Agent panel's animation duration

      prevShowAgentRef.current = showAgent;
      return () => clearTimeout(timer);
    }
  }, [showAgent]);

  return (
    <div
      className={`fixed top-5 flex gap-2 p-2 z-[2000] bg-primary rounded-md shadow-lg backdrop-blur-md
        ${isDragging || isAnimating ? "" : "transition-all duration-200 ease-out"}`}
      style={{ right: rightPosition }}
    >
      {/* Agent Button */}
      <ToolbarButton
        onClick={toggleAgent}
        title={t("agent")}
        isActive={showAgent}
      >
        <ChatBubbleLeftRightIcon className="w-5 h-5" />
      </ToolbarButton>

      {/* Auto Scroll Button */}
      <ToolbarButton
        onClick={toggleAutoScroll}
        title={t("autoScroll")}
        isActive={isAutoScrolling}
      >
        {isAutoScrolling ? (
          <PauseIcon className="w-5 h-5" />
        ) : (
          <PlayIcon className="w-5 h-5" />
        )}
      </ToolbarButton>

      {/* Translate Article Button */}
      {translateArticle && (
        <ToolbarButton
          onClick={translateArticle}
          title={t("translateArticle")}
          isActive={isTranslating}
        >
          <LanguageIcon className="w-5 h-5" />
        </ToolbarButton>
      )}

      {/* Save as Markdown Button */}
      <ToolbarButton onClick={handleMarkdownDownload} title={t("download")}>
        <ArrowDownTrayIcon className="w-5 h-5" />
      </ToolbarButton>

      {/* Fullscreen Button */}
      <ToolbarButton
        onClick={toggleFullscreen}
        title={t("fullscreen")}
        isActive={isFullscreen}
      >
        {isFullscreen ? (
          <ArrowsPointingInIcon className="w-5 h-5" />
        ) : (
          <ArrowsPointingOutIcon className="w-5 h-5" />
        )}
      </ToolbarButton>

      {/* Settings Button */}
      <ToolbarButton
        buttonRef={settingsButtonRef}
        onClick={toggleSettings}
        title={t("settings")}
        isActive={showSettings}
      >
        <Cog6ToothIcon className="w-5 h-5" />
      </ToolbarButton>

      {/* Close Reader Button */}
      <ToolbarButton onClick={handleClose} title={t("close")}>
        <XMarkIcon className="w-5 h-5" />
      </ToolbarButton>
    </div>
  );
};

// Toolbar Button Component to reduce redundancy
interface ToolbarButtonProps {
  onClick: () => void;
  title: string;
  isActive?: boolean;
  children: React.ReactNode;
  buttonRef?: React.RefObject<HTMLButtonElement>;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  title,
  isActive = false,
  children,
  buttonRef,
}) => {
  return (
    <button
      ref={buttonRef}
      className={`w-8 h-8 flex items-center justify-center cursor-pointer border-none rounded-md transition-all duration-150 ease-in-out
        ${
          isActive
            ? "bg-accent/10 text-accent shadow-sm"
            : "bg-transparent text-primary/70 hover:bg-primary/5 hover:text-primary"
        }`}
      onClick={onClick}
      title={title}
    >
      <div className="w-5 h-5 flex items-center justify-center">{children}</div>
    </button>
  );
};

export default ReaderToolbar;
