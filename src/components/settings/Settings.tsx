import React, {
  useState,
  useEffect,
  useMemo,
  memo,
  useRef,
  useCallback,
} from "react";
import { useReader } from "~/context/ReaderContext";
import { useI18n } from "~/context/I18nContext";
import { LanguageCode } from "~/utils/language";
// Removed unused import: ThemeType
import ThemeSection from "./sections/ThemeSection";
import FontSizeSection from "./sections/FontSizeSection";
import FontFamilySection from "./sections/FontFamilySection";
import WidthSection from "./sections/WidthSection";
import AlignmentSection from "./sections/AlignmentSection";
import SpacingSection from "./sections/SpacingSection";
import { createLogger } from "~/utils/logger";

// Create a logger for this module
const logger = createLogger("settings");

// Common props shared by all section components
export type SectionProps = {
  sectionClassName: string;
  titleClassName: string;
  settings: any;
  t: (key: string) => string;
  updateSettings: (settings: any) => void;
};

// Memoize section components to prevent unnecessary re-renders
const MemoizedThemeSection = memo(ThemeSection);
const MemoizedFontSizeSection = memo(FontSizeSection);
const MemoizedWidthSection = memo(WidthSection);
const MemoizedSpacingSection = memo(SpacingSection);

interface SettingsProps {
  onClose: () => void;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
  onSettingsChanged?: (newSettings: Record<string, any>) => void;
}

/**
 * Settings component
 * Allows customization of reader appearance with Kindle-style UI
 * Uses Tailwind CSS responsive classes for fully responsive design
 */
const Settings: React.FC<SettingsProps> = ({
  onClose,
  buttonRef,
  onSettingsChanged,
}) => {
  const { settings, updateSettings, article } = useReader();
  const { t, uiLanguage } = useI18n();
  const [detectedLanguage, setDetectedLanguage] = useState<LanguageCode | null>(
    null,
  );

  // Get button position for panel positioning
  const [buttonPosition, setButtonPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);

  // Auto-close functionality
  const autoCloseTimeoutRef = useRef<number | null>(null);
  const [, setIsHovered] = useState(false);

  // Clear auto-close timeout
  const clearAutoCloseTimeout = useCallback(() => {
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
  }, []);

  // Handle mouse enter - cancel auto-close
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    clearAutoCloseTimeout();
  }, [clearAutoCloseTimeout]);

  // Handle mouse leave - start auto-close timer
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    // Clear any existing timeout
    clearAutoCloseTimeout();

    // Set a delay before closing (800ms gives users time to move cursor)
    autoCloseTimeoutRef.current = window.setTimeout(() => {
      logger.info("Auto-closing settings panel after mouse leave");
      onClose();
    }, 800);
  }, [clearAutoCloseTimeout, onClose]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      clearAutoCloseTimeout();
    };
  }, [clearAutoCloseTimeout]);

  // Track button position for panel placement
  useEffect(() => {
    if (buttonRef?.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setButtonPosition({
        top: rect.top,
        right: window.innerWidth - rect.right,
      });
    }
  }, [buttonRef]);

  // Update position when window resizes
  useEffect(() => {
    const handleResize = () => {
      if (buttonRef?.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setButtonPosition({
          top: rect.top,
          right: window.innerWidth - rect.right,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [buttonRef]);

  // Detect article language using the language property from parser
  useEffect(() => {
    if (article?.language) {
      const lang = article.language as LanguageCode;
      logger.info(`Detected content language: ${lang}`);
      setDetectedLanguage(lang);
    }
  }, [article]);

  // Enhanced updateSettings function that also calls onSettingsChanged
  const updateSettingsWithCallback = useMemo(() => {
    return (newSettings: Record<string, any>) => {
      // Call the original updateSettings
      updateSettings(newSettings);

      // Notify parent component if callback is provided
      if (onSettingsChanged) {
        onSettingsChanged(newSettings);
      }
    };
  }, [updateSettings, onSettingsChanged]);

  // Calculate panel position based on button location
  const panelPositionStyle = useMemo(() => {
    // On small screens, use full screen mode
    if (window.innerWidth < 640) return {};

    if (buttonPosition) {
      const topPosition = Math.min(
        buttonPosition.top + 45,
        window.innerHeight - 500,
      );
      const rightPosition = buttonPosition.right + 10;

      return {
        top: `${topPosition}px`,
        right: `${rightPosition}px`,
        position: "fixed" as const,
      };
    }

    // Default position if button position is not available
    return {
      top: "80px",
      right: "20px",
      position: "fixed" as const,
    };
  }, [buttonPosition]);

  // Common classes for section and title to reduce repetition
  const sectionClassName = "py-4 px-3 border-b border-border";
  const titleClassName =
    "m-0 mb-2.5 text-sm sm:text-xs font-medium text-opacity-90";

  // Common props for all section components
  const commonSectionProps = useMemo(
    () => ({
      sectionClassName,
      titleClassName,
      settings,
      t,
      updateSettings: updateSettingsWithCallback,
    }),
    [sectionClassName, titleClassName, settings, t, updateSettingsWithCallback],
  );

  // Special props for last section
  const lastSectionClassName = `py-4 px-3 border-b border-border sm:border-b-0`;

  return (
    <div
      className="fixed sm:static sm:w-[320px] md:w-[350px] sm:rounded-lg sm:border sm:shadow-lg 
                inset-0 sm:inset-auto z-[2147483647]
                flex flex-col overflow-auto text-sm bg-primary text-primary border-border"
      style={{ ...panelPositionStyle, transform: "translateZ(0)" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex justify-between items-center p-3 py-3 sm:py-3 border-b border-border">
        <h2 className="m-0 text-base sm:text-sm font-medium">
          {t("displaySettings")}
        </h2>
        <div className="flex gap-3 sm:gap-2 items-center">
          <button
            onClick={onClose}
            className="bg-transparent border-none text-xl sm:text-lg p-1.5 sm:p-1 
                      cursor-pointer text-current ml-2 flex items-center justify-center 
                      opacity-70 hover:opacity-100 transition-opacity"
            aria-label={t("close")}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="max-h-[calc(100%-60px)] sm:max-h-[calc(100vh-160px)] overflow-y-auto flex-1">
        <div>
          {/* Theme Section */}
          <MemoizedThemeSection {...commonSectionProps} />

          {/* Font Size Section */}
          <MemoizedFontSizeSection {...commonSectionProps} />

          {/* Font Family Section */}
          <FontFamilySection
            {...commonSectionProps}
            uiLanguage={uiLanguage}
            detectedLanguage={detectedLanguage}
          />

          {/* Width Section */}
          <MemoizedWidthSection {...commonSectionProps} />

          {/* Text Alignment Section */}
          <AlignmentSection {...commonSectionProps} uiLanguage={uiLanguage} />

          {/* Line Spacing Section */}
          <MemoizedSpacingSection
            {...commonSectionProps}
            sectionClassName={lastSectionClassName}
          />
        </div>

        {/* Safe area for iOS devices to avoid notch/home indicator */}
        <div className="pb-[env(safe-area-inset-bottom,20px)] sm:pb-0" />
      </div>
    </div>
  );
};

export default memo(Settings);
