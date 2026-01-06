import React from "react";
import { spacingOptions } from "../../../config/ui";
import { createLogger } from "../../../utils/logger";
import { ReaderSettings } from "../../../types/reader";

// Create a logger for this module
const logger = createLogger("settings");

interface SpacingSectionProps {
  sectionClassName: string;
  titleClassName: string;
  settings: ReaderSettings;
  t: (key: string) => string;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
}

/**
 * Line spacing section in the settings panel
 */
const SpacingSection: React.FC<SpacingSectionProps> = ({
  sectionClassName,
  titleClassName,
  settings,
  t,
  updateSettings,
}) => {
  // Change the line spacing
  const changeSpacing = (spacing: string) => {
    const option = spacingOptions.find((opt) => opt.value === spacing);
    if (option) {
      logger.info(
        `[Settings] Changing spacing to: ${spacing} (lineHeight: ${option.lineHeight})`,
      );
      updateSettings({
        spacing,
        lineHeight: option.lineHeight,
      });
    }
  };

  // Map spacing values to height classes for visual representation
  const spacingHeightMap = {
    tight: "h-1", // 4px
    normal: "h-[7px]", // 7px
    loose: "h-2.5", // 10px
  };

  return (
    <section className={sectionClassName}>
      <h3 className={titleClassName}>{t("lineSpacing")}</h3>

      <div className="flex gap-1.5">
        {spacingOptions.map((option) => {
          const isActive = settings.spacing === option.value;
          const spacingHeightClass =
            spacingHeightMap[option.value as keyof typeof spacingHeightMap] ||
            "h-[7px]";

          return (
            <button
              key={option.value}
              onClick={() => changeSpacing(option.value)}
              className={`flex-1 border rounded p-1.5 flex flex-col items-center 
                        cursor-pointer transition-all text-xs
                        ${
                          isActive
                            ? "border-accent bg-accent/5 text-accent font-medium"
                            : "border-border bg-transparent text-primary"
                        }`}
              aria-pressed={isActive}
            >
              {/* Spacing visualization */}
              <div className="flex flex-col w-full mb-1 items-center">
                <div className="w-10 h-[3px] bg-current rounded-sm" />
                <div className={spacingHeightClass} />
                <div className="w-10 h-[3px] bg-current rounded-sm" />
                <div className={spacingHeightClass} />
                <div className="w-10 h-[3px] bg-current rounded-sm" />
              </div>

              {/* Label */}
              <span>{t(option.spacingClass || option.value)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default SpacingSection;
