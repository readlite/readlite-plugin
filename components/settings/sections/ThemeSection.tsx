import React from "react";
import {
  ThemeType,
  AVAILABLE_THEMES,
  DISPLAY_THEMES,
  themeTokens,
} from "../../../config/theme";
import { createLogger } from "../../../utils/logger";
import { applyThemeGlobally } from "../../../utils/themeManager";

const logger = createLogger("settings");

interface ThemeSectionProps {
  sectionClassName: string;
  titleClassName: string;
  settings: any;
  t: (key: string) => string;
  updateSettings: (settings: any) => void;
  uiLanguage?: string;
}

const themeLabels: Record<
  ThemeType,
  { zh: string; en: string; descZh: string; descEn: string }
> = {
  ink: {
    zh: "纸墨单色",
    en: "Print Mono",
    descZh: "柔和黑白，模拟纸质印刷",
    descEn: "Soft monochrome, print-like feel",
  },
  obsidian: {
    zh: "夜读专业",
    en: "Night Pro",
    descZh: "低眩光深色，OLED 友好",
    descEn: "Low-glare dark mode tuned for OLED",
  },
  ceramic: {
    zh: "冷静蓝",
    en: "Focus Blue",
    descZh: "冷灰蓝基调，适合技术/长文",
    descEn: "Cool blue-gray tuned for dense reading",
  },
  classic: {
    zh: "纸感经典",
    en: "Paper Classic",
    descZh: "暖白纸张质感，长期阅读舒适",
    descEn: "Warm paper-like surface for long reads",
  },
  bamboo: {
    zh: "柔和灰绿",
    en: "Soft Green",
    descZh: "低饱和灰绿，放松但非医疗意义护眼",
    descEn: "Muted gray-green, relaxing tone",
  },
  phantom: {
    zh: "科技紫",
    en: "Tech Violet",
    descZh: "低饱和紫灰，科技质感",
    descEn: "Muted violet-gray with tech vibe",
  },
};

const ThemeSection: React.FC<ThemeSectionProps> = ({
  sectionClassName,
  titleClassName,
  settings,
  t,
  updateSettings,
  uiLanguage = "en",
}) => {
  const isUiChinese = uiLanguage.toLowerCase().startsWith("zh");

  const changeTheme = (theme: ThemeType) => {
    logger.info(`[Settings] Changing theme to: ${theme}`);
    updateSettings({ theme });
    applyThemeGlobally(theme, document);
  };

  return (
    <section className={sectionClassName}>
      <h3 className={titleClassName}>{t("theme") || (isUiChinese ? "主题" : "Theme")}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {DISPLAY_THEMES.map((theme) => {
          const isActive = settings.theme === theme;
          const label = isUiChinese ? themeLabels[theme].zh : themeLabels[theme].en;
          const desc = isUiChinese ? themeLabels[theme].descZh : themeLabels[theme].descEn;
          const colors = themeTokens[theme];

          return (
            <button
              key={theme}
              onClick={() => changeTheme(theme)}
              className={`w-full text-left border rounded-lg p-3 transition-all
                ${isActive ? "border-accent bg-accent/5 text-accent" : "border-border bg-transparent text-ink hover:bg-surface/70"}`}
              aria-pressed={isActive}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{label}</div>
                {isActive && <span className="text-xs text-accent">✓</span>}
              </div>
              <div className="text-[11px] text-ink/70 mt-1 line-clamp-1">{desc}</div>
              <div className="flex gap-1 mt-2">
                <ColorChip color={colors.bg.primary} />
                <ColorChip color={colors.text.primary} />
                <ColorChip color={colors.ui.accent} />
                <ColorChip color={colors.ui.border} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

const ColorChip: React.FC<{ color: string }> = ({ color }) => (
  <span
    className="w-6 h-6 rounded-md border border-border/70"
    style={{ background: color }}
  />
);

export default ThemeSection;
