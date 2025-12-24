import React from "react";
import { widthOptions } from "~/config/ui";

interface WidthSectionProps {
  sectionClassName: string;
  titleClassName: string;
  settings: any;
  t: (key: string) => string;
  updateSettings: (settings: any) => void;
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
}) => {
  // Change the content width
  const changeWidth = (width: number) => {
    updateSettings({ width });
  };

  // Get width representation based on option
  const getWidthClass = (widthClass: string) => {
    if (widthClass === "narrow") return "w-[30%]";
    if (widthClass === "standard") return "w-[50%]";
    return "w-[70%]";
  };

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
                            : "border-border bg-transparent text-primary"
                        }`}
              aria-pressed={isActive}
            >
              <div className="w-full h-2.5 mb-1.5 flex justify-center">
                <div
                  className={`bg-current rounded-sm ${getWidthClass(option.widthClass)}`}
                />
              </div>
              <span>{t(option.label.en.toLowerCase())}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default WidthSection;
