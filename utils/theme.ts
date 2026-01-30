import { Theme } from "@/types/theme";

/**
 * Apply a theme to the document root via data-theme.
 * `classic` uses :root defaults (no data-theme) for minimal CSS churn.
 */
export const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === "classic") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
};

export const getCurrentTheme = (): Theme => {
  const attr = document.documentElement.getAttribute("data-theme") as Theme | null;
  return attr ?? "ink";
};
