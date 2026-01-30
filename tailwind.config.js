/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./entrypoints/**/*.{html,ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./context/**/*.{ts,tsx}",
    "./styles/**/*.css",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT:
            "rgb(var(--readlite-bg-primary-rgb, 255 255 255) / <alpha-value>)",
          subtle:
            "rgb(var(--readlite-bg-secondary-rgb, 249 250 251) / <alpha-value>)",
          muted:
            "rgb(var(--readlite-bg-tertiary-rgb, 243 244 246) / <alpha-value>)",
        },
        ink: {
          DEFAULT:
            "rgb(var(--readlite-text-primary-rgb, 17 24 39) / <alpha-value>)",
          muted:
            "rgb(var(--readlite-text-secondary-rgb, 107 114 128) / <alpha-value>)",
        },
        accent:
          "rgb(var(--readlite-accent-rgb, 59 130 246) / <alpha-value>)",
        border:
          "rgb(var(--readlite-border-rgb, 229 231 235) / <alpha-value>)",
        error: "rgb(var(--readlite-error-rgb, 239 68 68) / <alpha-value>)",
      },
      boxShadow: {
        sheet: "0 18px 50px rgba(0, 0, 0, 0.08)",
        floating: "0 10px 30px rgba(0, 0, 0, 0.12)",
      },
      borderRadius: {
        xl: "20px",
        "2xl": "28px",
      },
      transitionTimingFunction: {
        "swift-out": "cubic-bezier(0.25, 0.8, 0.25, 1)",
      },
    },
  },
  plugins: [],
}
