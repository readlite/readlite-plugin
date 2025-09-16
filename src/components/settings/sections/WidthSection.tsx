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

  // Get width representation based on option for the preview pill
  const getWidthClass = (widthClass: string) => {
    if (widthClass === "narrow") return "w-[28%]";
    if (widthClass === "standard") return "w-[50%]";
    return "w-[72%]";
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
              className={`flex-1 border rounded-md p-2 flex flex-col items-center gap-1 
                        cursor-pointer transition-colors text-xs select-none
                        ${
                          isActive
                            ? "border-accent bg-accent/5 text-accent font-medium"
                            : "border-border text-primary hover:bg-primary/5"
                        }`}
              aria-pressed={isActive}
              aria-label={`${t("contentWidth")} ${option.value}px`}
            >
              <div className="w-full">
                <div className="h-6 rounded-sm border border-border/60 bg-primary/40 flex items-center justify-center">
                  <div className={`h-3 bg-current/80 rounded ${getWidthClass(option.widthClass)}`} />
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <span>{t(option.label.en.toLowerCase())}</span>
                <span className="text-secondary">·</span>
                <span className="text-secondary">{option.value}px</span>
              </div>
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-secondary">{customWidthValue}px</span>
            <input
              type="number"
              min={400}
              max={1200}
              step={10}
              value={customWidthValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCustomWidthChange(e)}
              className="w-16 h-6 text-xs px-1 border border-border rounded bg-transparent text-primary"
              aria-label={t("customWidth")}
            />
          </div>
        </div>

        <div className="relative">
          <input
            type="range"
            min="400"
            max="1200"
            step="10"
            value={customWidthValue}
            onChange={handleCustomWidthChange}
            className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-3.5
                     [&::-webkit-slider-thumb]:h-3.5
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-accent
                     [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-webkit-slider-thumb]:transition-transform
                     [&::-webkit-slider-thumb]:hover:scale-110
                     [&::-moz-range-thumb]:w-3.5
                     [&::-moz-range-thumb]:h-3.5
                     [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-accent
                     [&::-moz-range-thumb]:border-0
                     [&::-moz-range-thumb]:cursor-pointer
                     [&::-moz-range-thumb]:transition-transform
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
