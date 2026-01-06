import React, { useState, useEffect } from "react";
import {
  ThemeType,
  AVAILABLE_THEMES,
  themeTokens,
} from "../../../config/theme";
import { createLogger } from "../../../utils/logger";
import { applyThemeGlobally } from "../../../utils/themeManager";
import { ReaderSettings } from "../../../types/reader";

// Create a logger for this module
const logger = createLogger("settings");

interface ThemeSectionProps {
  sectionClassName: string;
  titleClassName: string;
  settings: ReaderSettings;
  t: (key: string) => string;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
}

interface ColorPickerProps {
  label: string;
  color: string;
  onChange: (color: string) => void;
  t: (key: string) => string;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  color,
  onChange,
  t,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(color);

  useEffect(() => {
    setInputValue(color);
  }, [color]);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleColorBlur = () => {
    // Only update if it's a valid hex color
    if (/^#([0-9A-F]{3}){1,2}$/i.test(inputValue)) {
      onChange(inputValue);
    } else {
      setInputValue(color); // Reset to the current color if invalid
    }
  };

  const handleColorInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleColorBlur();
    }
  };

  return (
    <div className="mb-3 relative">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-primary">{t(label)}</label>

        <div className="flex items-center gap-2">
          {/* Color field with integrated picker */}
          <div className="flex h-7">
            <div
              className="w-8 h-full rounded-l border-l border-t border-b border-border flex items-center justify-center cursor-pointer"
              onClick={() => setIsOpen(!isOpen)}
              aria-label={`${t("pickColor")} ${t(label)}`}
              style={{ backgroundColor: color }}
            />
            <div className="relative">
              <input
                type="text"
                value={inputValue}
                onChange={handleColorChange}
                onBlur={handleColorBlur}
                onKeyDown={handleColorInputKeyDown}
                className="text-xs h-full w-24 px-2 border border-border outline-none rounded-r text-primary"
                maxLength={7}
                aria-label={`${t("colorCode")} ${t(label)}`}
              />
              <input
                type="color"
                value={color}
                onChange={(e) => onChange(e.target.value)}
                className="absolute opacity-0 inset-0 cursor-pointer w-full h-full"
                id={`color-picker-${label}`}
                aria-label={`${t("colorWheel")} ${t(label)}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Color Picker Panel */}
      {isOpen && (
        <div className="absolute z-10 right-0 mt-1.5 p-3 rounded-lg border border-border shadow-xl w-48 bg-primary animate-colorPickerFadeIn">
          {/* Color wheel for precise selection */}
          <div className="mb-2">
            <div className="text-xs font-medium mb-1.5 text-primary/75">
              {t("colorPicker")}
            </div>
            <input
              type="color"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-16 rounded border border-border cursor-pointer"
              aria-label={t("colorWheel")}
            />
          </div>

          {/* Direct Hex input */}
          <div>
            <div className="text-xs font-medium mb-1.5 text-primary/75">
              {t("hexCode")}
            </div>
            <input
              type="text"
              value={inputValue}
              onChange={handleColorChange}
              onBlur={handleColorBlur}
              onKeyDown={handleColorInputKeyDown}
              className="text-xs h-7 w-full px-2 border border-border outline-none rounded text-primary focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
              maxLength={7}
              aria-label={`${t("hexCode")} ${t(label)}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Theme selection section in the settings panel
 */
const ThemeSection: React.FC<ThemeSectionProps> = ({
  sectionClassName,
  titleClassName,
  settings,
  t,
  updateSettings,
}) => {
  // Custom theme settings with defaults from theme tokens
  const [customTheme, setCustomTheme] = useState({
    bgPrimary: themeTokens.custom.bg.primary,
    textPrimary: themeTokens.custom.text.primary,
    accent: themeTokens.custom.accent,
    border: themeTokens.custom.border,
  });

  // Update color picker initial values when custom theme is selected
  useEffect(() => {
    if (settings.theme === "custom" && settings.customTheme) {
      try {
        const savedCustomTheme = JSON.parse(settings.customTheme);
        setCustomTheme({
          bgPrimary:
            savedCustomTheme.bgPrimary || themeTokens.custom.bg.primary,
          textPrimary:
            savedCustomTheme.textPrimary || themeTokens.custom.text.primary,
          accent: savedCustomTheme.accent || themeTokens.custom.accent,
          border: savedCustomTheme.border || themeTokens.custom.border,
        });
      } catch (e) {
        logger.error("Failed to parse saved custom theme", e);
      }
    }
  }, [settings.theme, settings.customTheme]);

  // Change the theme
  const changeTheme = (theme: ThemeType) => {
    logger.info(`[Settings] Changing theme to: ${theme}`);

    // When switching to custom, preserve existing custom theme if available
    if (theme === "custom") {
      // Check if there's an existing custom theme saved
      let existingCustomTheme = settings.customTheme;

      // If no custom theme in settings, try to load from localStorage
      if (!existingCustomTheme) {
        try {
          const savedCustomTheme = localStorage.getItem(
            "readlite-custom-theme",
          );
          if (savedCustomTheme) {
            logger.info(
              "Loading custom theme from localStorage:",
              savedCustomTheme,
            );
            existingCustomTheme = savedCustomTheme;
          }
        } catch (e) {
          logger.error("Failed to load custom theme from localStorage", e);
        }
      }

      // Use existing settings or initialize with current theme as defaults if no custom theme exists
      const currentTheme = (settings.theme as ThemeType) || "light";
      const themeDefaults = existingCustomTheme
        ? JSON.parse(existingCustomTheme)
        : {
            bgPrimary: themeTokens[currentTheme].bg.primary,
            textPrimary: themeTokens[currentTheme].text.primary,
            accent: themeTokens[currentTheme].accent,
            border: themeTokens[currentTheme].border,
          };

      // Set local state to theme defaults
      setCustomTheme(themeDefaults);

      // Create customTheme JSON string
      const customThemeStr = JSON.stringify(themeDefaults);

      // Save to localStorage
      try {
        localStorage.setItem("readlite-custom-theme", customThemeStr);
      } catch (e) {
        logger.error("Failed to save custom theme to localStorage", e);
      }

      // Update settings - Theme application will be handled by context
      updateSettings({
        theme: "custom",
        customTheme: customThemeStr,
      });

      // Apply directly for immediate feedback
      try {
        applyThemeGlobally("custom", customThemeStr);

        // Trigger repaint event for CSS variable consumers
        setTimeout(() => {
          const cssUpdateEvent = new CustomEvent("readlite-theme-updated", {
            detail: { theme: "custom", customTheme: customThemeStr },
          });
          document.dispatchEvent(cssUpdateEvent);
        }, 50);
      } catch (e) {
        logger.error("Failed to directly apply theme", e);
      }
    } else {
      // For standard themes
      // Update settings - Theme application will be handled by context
      updateSettings({ theme });

      // Apply directly for immediate feedback
      try {
        applyThemeGlobally(theme);
      } catch (e) {
        logger.error("Failed to directly apply theme", e);
      }
    }
  };

  // Update custom theme colors
  const updateCustomColor = (key: string, value: string) => {
    // Create updated theme object
    const updatedTheme = { ...customTheme, [key]: value };

    // Update local state
    setCustomTheme(updatedTheme);

    // Apply changes immediately if current theme is custom
    if (settings.theme === "custom") {
      // Create customTheme JSON string
      const customThemeStr = JSON.stringify(updatedTheme);

      // Always save to localStorage first for persistence
      try {
        localStorage.setItem("readlite-custom-theme", customThemeStr);
        logger.info("Saved custom theme to localStorage:", customThemeStr);
      } catch (e) {
        logger.error("Failed to save custom theme to localStorage", e);
      }

      // Update settings in the context
      updateSettings({ customTheme: customThemeStr });

      // Apply directly for immediate feedback
      try {
        applyThemeGlobally("custom", customThemeStr);

        // Trigger repaint event for CSS variable consumers
        setTimeout(() => {
          const cssUpdateEvent = new CustomEvent("readlite-theme-updated", {
            detail: { theme: "custom", customTheme: customThemeStr },
          });
          document.dispatchEvent(cssUpdateEvent);
        }, 50);
      } catch (e) {
        logger.error("Failed to directly apply theme", e);
      }
    }
  };

  return (
    <section className={sectionClassName}>
      <h3 className={titleClassName}>{t("readingTheme")}</h3>

      <div className="flex gap-1.5 mb-4">
        {AVAILABLE_THEMES.map((themeOption) => {
          const isActive = settings.theme === themeOption;
          const displayName =
            t(themeOption) ||
            themeOption.charAt(0).toUpperCase() + themeOption.slice(1);

          return (
            <button
              key={themeOption}
              onClick={() => changeTheme(themeOption)}
              className={`flex-1 border rounded p-1.5 flex items-center justify-center 
                        cursor-pointer transition-all text-xs
                        ${
                          isActive
                            ? "border-accent bg-accent/5 text-accent font-medium"
                            : "border-border text-primary hover:bg-primary/5"
                        }`}
              aria-pressed={isActive}
            >
              {displayName}
            </button>
          );
        })}
      </div>

      {/* Custom theme settings */}
      {settings.theme === "custom" && (
        <div className="mt-3 p-3 rounded-lg border border-border">
          <h4 className="text-xs font-medium mb-3 text-primary">
            {t("customTheme")}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
            <ColorPicker
              label="background"
              color={customTheme.bgPrimary}
              onChange={(color) => updateCustomColor("bgPrimary", color)}
              t={t}
            />

            <ColorPicker
              label="text"
              color={customTheme.textPrimary}
              onChange={(color) => updateCustomColor("textPrimary", color)}
              t={t}
            />

            <ColorPicker
              label="accent"
              color={customTheme.accent}
              onChange={(color) => updateCustomColor("accent", color)}
              t={t}
            />

            <ColorPicker
              label="border"
              color={customTheme.border}
              onChange={(color) => updateCustomColor("border", color)}
              t={t}
            />
          </div>
        </div>
      )}
    </section>
  );
};

export default ThemeSection;
