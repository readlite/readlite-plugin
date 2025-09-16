import React, { useState, useEffect } from "react";
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
  // State for custom width
  const [isCustomWidth, setIsCustomWidth] = useState(false);
  const [customWidthValue, setCustomWidthValue] = useState(settings.width);

  // Check if current width matches any preset
  useEffect(() => {
    const isPreset = widthOptions.some(option => option.value === settings.width);
    setIsCustomWidth(!isPreset);
    setCustomWidthValue(settings.width);
  }, [settings.width]);

  // Change the content width
  const changeWidth = (width: number) => {
    setIsCustomWidth(false);
    updateSettings({ width, useCustomWidth: false });
  };

  // Handle custom width change
  const handleCustomWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setCustomWidthValue(value);
    setIsCustomWidth(true);
    updateSettings({ width: value, useCustomWidth: true });
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
          const isActive = settings.width === option.value && !isCustomWidth;
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

      {/* Custom Width Slider */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-primary font-medium">
            {t("customWidth")}
          </label>
          <span className="text-xs text-secondary">
            {customWidthValue}px
          </span>
        </div>
        
        <div className="relative">
          <input
            type="range"
            min="400"
            max="1200"
            step="10"
            value={customWidthValue}
            onChange={handleCustomWidthChange}
            className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-3.5
                     [&::-webkit-slider-thumb]:h-3.5
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-accent
                     [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-webkit-slider-thumb]:transition-all
                     [&::-webkit-slider-thumb]:hover:scale-110
                     [&::-moz-range-thumb]:w-3.5
                     [&::-moz-range-thumb]:h-3.5
                     [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-accent
                     [&::-moz-range-thumb]:border-0
                     [&::-moz-range-thumb]:cursor-pointer
                     [&::-moz-range-thumb]:transition-all
                     [&::-moz-range-thumb]:hover:scale-110"
            style={{
              background: `linear-gradient(to right, rgb(var(--accent)) 0%, rgb(var(--accent)) ${((customWidthValue - 400) / (1200 - 400)) * 100}%, rgb(var(--border)) ${((customWidthValue - 400) / (1200 - 400)) * 100}%, rgb(var(--border)) 100%)`
            }}
          />
          
          {/* Width indicator */}
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-secondary">400px</span>
            <span className="text-[10px] text-secondary">1200px</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WidthSection;
