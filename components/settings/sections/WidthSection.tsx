import React from "react";
import { widthOptions } from "@/config/ui";

interface WidthSectionProps {
  sectionClassName: string;
  titleClassName: string;
  settings: any;
  t: (key: string) => string;
  updateSettings: (settings: any) => void;
  uiLanguage?: string;
}

/**
 * Width adjustment section in the settings panel
 */
const WidthSection: React.FC<WidthSectionProps> = ({
  sectionClassName,
  titleClassName,
  settings,
  t,
  updateSettings,
  uiLanguage = "en",
}) => {
  // Change the content width
  const changeWidth = (width: number) => {
    updateSettings({ width });
  };

  // Get width representation based on option
  const getWidthClass = (widthClass: string) => {
    switch (widthClass) {
      case "narrow":
        return "w-[30%]";
      case "standard":
        return "w-[50%]";
      case "wide":
        return "w-[70%]";
      case "full":
        return "w-full";
      default:
        return "w-[50%]";
    }
  };

  const isUiChinese = uiLanguage.toLowerCase().startsWith("zh");

  return (
    <section className={sectionClassName}>
      <h3 className={titleClassName}>{t("contentWidth")}</h3>

      <div className="flex gap-1.5">
        {widthOptions.map((option) => {
          const isActive = settings.width === option.value;
          return (
            <button
              key={option.value}
              onClick={() => changeWidth(option.value)}
              className={`flex-1 border rounded p-1.5 flex flex-col items-center 
                        cursor-pointer transition-all text-xs
                        ${
                          isActive
                            ? "border-accent bg-accent/5 text-accent font-medium"
                            : "border-border bg-transparent text-ink"
                        }`}
              aria-pressed={isActive}
            >
              <div className="w-full h-2.5 mb-1.5 flex justify-center">
                <div
                  className={`bg-current rounded-sm ${getWidthClass(option.widthClass)}`}
                />
              </div>
              <span>
                {isUiChinese ? option.label.zh : option.label.en}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default WidthSection;
