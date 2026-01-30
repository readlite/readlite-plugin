import React, { useEffect } from "react";
import { FontOption, fontOptions } from "../../../config/ui";
import { LanguageCode } from "../../../utils/language";

interface FontFamilySectionProps {
  sectionClassName: string;
  titleClassName: string;
  settings: any;
  t: (key: string) => string;
  uiLanguage: LanguageCode;
  detectedLanguage: LanguageCode | null;
  updateSettings: (settings: any) => void;
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
  const isUiChinese = uiLanguage?.toLowerCase().startsWith("zh");

  // Set default font if not set (use a neutral stack, no recommendation)
  useEffect(() => {
    if (!settings.fontFamily || settings.fontFamily === "") {
      const defaultFont =
        '"Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif';
      updateSettings({
        fontFamily: defaultFont,
        fontFamilyCJK: defaultFont,
        fontFamilyLatin: defaultFont,
      });
    }
  }, [
    settings.fontFamily,
    settings.fontFamilyCJK,
    settings.fontFamilyLatin,
    updateSettings,
  ]);

  // Font family selection handler
  const changeFontFamily = (fontFamily: string) => {
    updateSettings({
      fontFamily,
      fontFamilyCJK: fontFamily,
      fontFamilyLatin: fontFamily,
    });
  };

  // No recommendations; all fonts in one list
  const recommendedFonts: FontOption[] = [];
  const otherFonts = fontOptions;

  const splitColumns = (fonts: FontOption[]) => {
    const mid = Math.ceil(fonts.length / 2);
    return [fonts.slice(0, mid), fonts.slice(mid)];
  };

  // Render a single font option
  const renderFontOption = (font: FontOption) => {
    const activeFont = settings.fontFamily;

    const isActive = activeFont === font.value;
    const displayName = isUiChinese ? font.label.zh : font.label.en;
    const isRecommended = false;

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
                       : "border-border bg-transparent text-ink"
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
      <div className="text-[10px] mb-2 text-ink/70">
        {isUiChinese ? "选择任意字体应用于阅读器" : "Pick any font to apply"}
      </div>

      <div className="grid grid-cols-2 gap-x-1.5">
        {splitColumns(otherFonts).map((col, idx) => (
          <div key={idx} className="space-y-1">
            {col.map(renderFontOption)}
          </div>
        ))}
      </div>
    </section>
  );
};

export default FontFamilySection;
