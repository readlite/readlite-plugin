import React, { useEffect } from "react";
import { FontOption, fontOptions } from "../../../config/ui";
import { LanguageCode } from "../../../utils/language";
import { ReaderSettings } from "../../../types/reader";

interface FontFamilySectionProps {
  sectionClassName: string;
  titleClassName: string;
  settings: ReaderSettings;
  t: (key: string) => string;
  uiLanguage: LanguageCode;
  detectedLanguage: LanguageCode | null;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
}

/**
 * Font family selection section in the settings panel
 */
const FontFamilySection: React.FC<FontFamilySectionProps> = ({
  sectionClassName,
  titleClassName,
  settings,
  t,
  uiLanguage,
  detectedLanguage,
  updateSettings,
}) => {
  // Set default font based on detected language if not set
  useEffect(() => {
    // Apply default font when fontFamily is empty or not set
    if (!settings.fontFamily || settings.fontFamily === "") {
      // For Chinese languages and dialects
      const chineseLanguages = ["zh", "cmn", "wuu", "yue"];
      const defaultFont = chineseLanguages.includes(detectedLanguage || "")
        ? fontOptions.find((f) => f.label.en === "PingFang")?.value
        : fontOptions.find((f) => f.label.en === "Bookerly")?.value;

      if (defaultFont) {
        // Apply default font without logging to console
        updateSettings({ fontFamily: defaultFont });
      }
    }
  }, [settings.fontFamily, detectedLanguage, updateSettings]);

  // Font family selection handler
  const changeFontFamily = (fontFamily: string) => {
    updateSettings({ fontFamily });
  };

  // Split fonts into two columns
  const midPoint = Math.ceil(fontOptions.length / 2);
  const firstColumnFonts = fontOptions.slice(0, midPoint);
  const secondColumnFonts = fontOptions.slice(midPoint);

  // Render a single font option
  const renderFontOption = (font: FontOption) => {
    const isActive = settings.fontFamily === font.value;
    const displayName = uiLanguage === "zh" ? font.label.zh : font.label.en;
    const isRecommended =
      detectedLanguage &&
      font.compatibleLanguages &&
      font.compatibleLanguages.includes(detectedLanguage);

    const fontFamily = font.value.split(",")[0];

    return (
      <button
        key={font.value}
        onClick={() => changeFontFamily(font.value)}
        className={`w-full mb-1 border rounded p-1.5 transition-all text-xs
                   flex items-center justify-between
                   ${
                     isActive
                       ? "border-accent bg-accent/5 text-accent"
                       : "border-border bg-transparent text-primary"
                   }`}
        aria-pressed={isActive}
      >
        <div className="flex items-center overflow-hidden">
          {/* Font preview with dynamic font family */}
          <span
            className="text-sm mr-2 min-w-[24px] flex-shrink-0"
            style={{ fontFamily }}
          >
            Aa
          </span>

          {/* Font name with star for recommended */}
          <div className="flex items-center overflow-hidden">
            <span className={`${isActive ? "font-medium" : ""} truncate`}>
              {displayName}
            </span>

            {/* Star icon for recommended fonts */}
            {isRecommended && (
              <span
                className={`ml-1 text-xs flex-shrink-0 ${isActive ? "text-accent" : "text-amber-400/80"}`}
              >
                ★
              </span>
            )}
          </div>
        </div>

        {/* Checkmark for active option */}
        {isActive && (
          <span className="text-xs flex-shrink-0 text-accent">✓</span>
        )}
      </button>
    );
  };

  return (
    <section className={sectionClassName}>
      <h3 className={titleClassName}>{t("fontFamily")}</h3>

      {/* Font section description with explanation */}
      {detectedLanguage && (
        <div className="text-[10px] mb-2 text-primary/70">
          {uiLanguage === "zh"
            ? `★ 表示适合${getLanguageDisplayName(detectedLanguage, uiLanguage)}内容的字体`
            : `★ indicates fonts optimized for ${getLanguageDisplayName(detectedLanguage, uiLanguage)} content`}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-1.5 mb-1">
        {/* First column */}
        <div className="space-y-1">
          {firstColumnFonts.map(renderFontOption)}
        </div>

        {/* Second column */}
        <div className="space-y-1">
          {secondColumnFonts.map(renderFontOption)}
        </div>
      </div>
    </section>
  );
};

// Helper function to get language display name (simplified version)
const getLanguageDisplayName = (
  langCode: LanguageCode,
  uiLanguage: LanguageCode,
): string => {
  if (langCode === "zh") {
    return uiLanguage === "zh" ? "中文" : "Chinese";
  }
  if (langCode === "en") {
    return uiLanguage === "zh" ? "英文" : "English";
  }
  return langCode;
};

export default FontFamilySection;
