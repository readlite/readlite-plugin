import React, { useEffect } from "react";
import {
  ArrowDownTrayIcon,
  Cog6ToothIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
} from "@heroicons/react/24/outline";

interface ReaderToolbarProps {
  handleMarkdownDownload: () => void;
  toggleSettings: () => void;
  handleClose: () => void;
  toggleFullscreen: () => void;
  isFullscreen: boolean;
  settingsButtonRef: React.RefObject<HTMLButtonElement>;
  showSettings: boolean;
  isDragging?: boolean;
  t: (key: string) => string;
  isVisible?: boolean;
}

/**
 * Toolbar component with control buttons for the reader
 */
const ReaderToolbar: React.FC<ReaderToolbarProps> = ({
  handleMarkdownDownload,
  toggleSettings,
  handleClose,
  toggleFullscreen,
  isFullscreen,
  settingsButtonRef,
  showSettings,
  isDragging = false,
  t,
  isVisible = true,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const shouldShow = isVisible || isHovered;

  return (
    <div
      className={`fixed top-12 right-5 flex items-center gap-2 px-3 py-2 z-[2000] readlite-glass shadow-floating border border-border/70 rounded-full
        ${isDragging ? "" : "transition-all duration-200 ease-out"}
        ${shouldShow ? "opacity-100 translate-y-0" : "opacity-70 -translate-y-1"}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="Reader controls"
    >
      <ToolbarButton onClick={handleMarkdownDownload} title={t("download")}>
        <ArrowDownTrayIcon className="w-5 h-5" />
      </ToolbarButton>

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

      <ToolbarButton
        buttonRef={settingsButtonRef}
        onClick={toggleSettings}
        title={t("settings")}
        isActive={showSettings}
      >
        <Cog6ToothIcon className="w-5 h-5" />
      </ToolbarButton>

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
      className={`w-10 h-10 flex items-center justify-center cursor-pointer border border-border/70 rounded-full transition-all duration-150 ease-in-out
        ${
          isActive
            ? "bg-accent/10 text-accent shadow-sm"
            : "bg-transparent text-ink/70 hover:bg-surface/80 hover:text-ink"
        }`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <div className="w-5 h-5 flex items-center justify-center">{children}</div>
    </button>
  );
};

export default ReaderToolbar;
