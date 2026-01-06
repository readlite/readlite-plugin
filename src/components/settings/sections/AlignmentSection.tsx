import React from "react";
import { alignmentOptions } from "../../../config/ui";
import { LanguageCode } from "../../../utils/language";
import { ReaderSettings } from "../../../context/ReaderContext";

interface AlignmentSectionProps {
  sectionClassName: string;
  titleClassName: string;
  settings: ReaderSettings;
  t: (key: string) => string;
  uiLanguage: LanguageCode;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
}

/**
 * Text alignment section in the settings panel
 */
const AlignmentSection: React.FC<AlignmentSectionProps> = ({
  sectionClassName,
  titleClassName,
  settings,
  t,
  uiLanguage,
  updateSettings,
}) => {
  // Change the text alignment
  const changeAlignment = (textAlign: string) => {
    updateSettings({ textAlign });
  };

  // Get alignment button class based on active state
  const getButtonClass = (isActive: boolean) => {
    return `p-1.5 flex flex-col items-center border rounded transition-all flex-1 cursor-pointer text-xs
            ${
              isActive
                ? "border-accent bg-accent/5 text-accent"
                : "border-border bg-transparent text-primary"
            }`;
  };

  return (
    <section className={sectionClassName}>
      <h3 className={titleClassName}>{t("textAlignment")}</h3>

      <div className="flex gap-1.5">
        {alignmentOptions.map((option) => {
          const isActive = settings.textAlign === option.value;
          const label = uiLanguage === "zh" ? option.label.zh : option.label.en;

          return (
            <button
              key={option.value}
              onClick={() => changeAlignment(option.value)}
              className={getButtonClass(isActive)}
              aria-pressed={isActive}
            >
              {/* Alignment icon */}
              <div className="flex w-full mb-1 justify-center">
                {/* Left alignment icon */}
                {option.value === "left" && (
                  <div className="flex flex-col items-start">
                    <div className="w-10 h-[3px] bg-current mb-[3px] rounded-sm" />
                    <div className="w-6 h-[3px] bg-current mb-[3px] rounded-sm" />
                    <div className="w-8 h-[3px] bg-current rounded-sm" />
                  </div>
                )}

                {/* Justify alignment icon */}
                {option.value === "justify" && (
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-[3px] bg-current mb-[3px] rounded-sm" />
                    <div className="w-10 h-[3px] bg-current mb-[3px] rounded-sm" />
                    <div className="w-10 h-[3px] bg-current rounded-sm" />
                  </div>
                )}

                {/* Center alignment icon */}
                {option.value === "center" && (
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-[3px] bg-current mb-[3px] rounded-sm" />
                    <div className="w-6 h-[3px] bg-current mb-[3px] rounded-sm" />
                    <div className="w-10 h-[3px] bg-current rounded-sm" />
                  </div>
                )}

                {/* Right alignment icon */}
                {option.value === "right" && (
                  <div className="flex flex-col items-end">
                    <div className="w-10 h-[3px] bg-current mb-[3px] rounded-sm" />
                    <div className="w-6 h-[3px] bg-current mb-[3px] rounded-sm" />
                    <div className="w-8 h-[3px] bg-current rounded-sm" />
                  </div>
                )}
              </div>

              {/* Label */}
              <span className={isActive ? "font-medium" : ""}>{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default AlignmentSection;
