import React from "react";
import { ReaderSettings } from "../../../types/reader";

interface FontSizeSectionProps {
  sectionClassName: string;
  titleClassName: string;
  settings: ReaderSettings;
  t: (key: string) => string;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
}

/**
 * Font size adjustment section in the settings panel
 */
const FontSizeSection: React.FC<FontSizeSectionProps> = ({
  sectionClassName,
  titleClassName,
  settings,
  t,
  updateSettings,
}) => {
  // Predefined font size values
  const MIN_FONT_SIZE = 12;
  const MAX_FONT_SIZE = 24;
  const MID_SIZE_1 = 16;
  const MID_SIZE_2 = 20;

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const size = parseInt(e.target.value);
    updateSettings({ fontSize: size });
  };

  return (
    <section className={sectionClassName}>
      <h3 className={titleClassName}>{t("fontSize")}</h3>

      {/* Font size slider with A indicators */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs w-5 text-center font-medium text-primary/70">
          A
        </span>
        <input
          type="range"
          min={MIN_FONT_SIZE}
          max={MAX_FONT_SIZE}
          step="1"
          value={settings.fontSize}
          onChange={handleFontSizeChange}
          className="flex-1 mx-2 cursor-pointer h-4 sm:h-3 accent-accent"
          aria-label={t("fontSize")}
        />
        <span className="text-base w-5 text-center font-medium text-primary/70">
          A
        </span>
      </div>

      {/* Current size indicator */}
      <div className="text-center mb-1 text-xs font-medium text-accent/80">
        {t("currentSize")}: {settings.fontSize}px
      </div>

      {/* Size indicators */}
      <div className="flex justify-between px-3 text-[10px] text-primary/50">
        <span>{MIN_FONT_SIZE}</span>
        <span>{MID_SIZE_1}</span>
        <span>{MID_SIZE_2}</span>
        <span>{MAX_FONT_SIZE}</span>
      </div>
    </section>
  );
};

export default FontSizeSection;
