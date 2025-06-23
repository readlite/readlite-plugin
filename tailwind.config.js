/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: 'class', // Use class names to toggle dark mode
  safelist: [
    // Make sure these theme-specific classes are included
    'dark:bg-amber-900/40',
    'dark:bg-cyan-900/40',
    'dark:bg-purple-900/40',
    'dark:bg-lime-900/40', 
    'dark:bg-rose-900/40',
    // Eyecare theme classes
    'eyecare:bg-amber-200/50',
    'eyecare:bg-cyan-200/50',
    'eyecare:bg-purple-200/50',
    'eyecare:bg-lime-200/50',
    'eyecare:bg-rose-200/50'
  ],
  theme: {
    extend: {
      colors: {
        // Background colors
        'bg-primary': 'var(--readlite-bg-primary)',
        'bg-secondary': 'var(--readlite-bg-secondary)',
        'bg-tertiary': 'var(--readlite-bg-tertiary)',
        'bg-user': 'var(--readlite-bg-user)',
        'bg-agent': 'var(--readlite-bg-agent)',
        'bg-input': 'var(--readlite-bg-input)',
        
        // Text colors
        'text-primary': 'var(--readlite-text-primary)',
        'text-secondary': 'var(--readlite-text-secondary)',
        'text-user': 'var(--readlite-text-user)',
        'text-agent': 'var(--readlite-text-agent)',
        'text-accent': 'var(--readlite-text-accent)',
        
        // UI elements
        'border': 'var(--readlite-border)',
        'accent': 'var(--readlite-accent)',
        'error': 'var(--readlite-error)',
        
        // Highlight colors
        'highlight-beige': 'var(--readlite-highlight-beige)',
        'highlight-cyan': 'var(--readlite-highlight-cyan)',
        'highlight-lavender': 'var(--readlite-highlight-lavender)', 
        'highlight-olive': 'var(--readlite-highlight-olive)',
        'highlight-peach': 'var(--readlite-highlight-peach)',
        'highlight-selection': 'var(--readlite-highlight-selection)',
        'highlight-selection-hover': 'var(--readlite-highlight-selection-hover)',
      },
      backgroundColor: {
        'primary': 'var(--readlite-bg-primary)',
        'secondary': 'var(--readlite-bg-secondary)',
        'tertiary': 'var(--readlite-bg-tertiary)',
        
        // Highlight background colors
        'highlight-beige': 'var(--readlite-highlight-beige)',
        'highlight-cyan': 'var(--readlite-highlight-cyan)',
        'highlight-lavender': 'var(--readlite-highlight-lavender)', 
        'highlight-olive': 'var(--readlite-highlight-olive)',
        'highlight-peach': 'var(--readlite-highlight-peach)',
        'highlight-selection': 'var(--readlite-highlight-selection)',
        'highlight-selection-hover': 'var(--readlite-highlight-selection-hover)',
      },
      textColor: {
        'primary': 'var(--readlite-text-primary)',
        'secondary': 'var(--readlite-text-secondary)',
        'accent': 'var(--readlite-text-accent)',
      },
      borderColor: {
        'default': 'var(--readlite-border)',
        'accent': 'var(--readlite-accent)',
      },
      // Custom scrollbar
      scrollbar: {
        track: 'var(--readlite-scrollbar-track)',
        thumb: 'var(--readlite-scrollbar-thumb)',
      },
      // Animation keyframes
      keyframes: {
        toolbarFadeIn: {
          'from': { 
            opacity: '0', 
            transform: 'translateY(5px)' 
          },
          'to': { 
            opacity: '1', 
            transform: 'translateY(0)' 
          },
        },
        colorPickerFadeIn: {
          'from': { 
            opacity: '0', 
            transform: 'translateX(-50%) translateY(-5px)' 
          },
          'to': { 
            opacity: '1', 
            transform: 'translateX(-50%) translateY(0)' 
          },
        },
        themeRefresh: {
          '0%': { opacity: '0.9' },
          '50%': { opacity: '0.98' },
          '100%': { opacity: '1' },
        },
        loading: {
          '0%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        dots: {
          '0%, 20%': { content: "''" },
          '40%': { content: "'·'" },
          '60%': { content: "'··'" },
          '80%, 100%': { content: "'···'" },
        },
        fadeInTranslation: {
          'from': { 
            opacity: '0',
            transform: 'translateY(5px)'
          },
          'to': { 
            opacity: '1',
            transform: 'translateY(0)'
          }
        },
        ellipsis: {
          '0%': { content: '"."' },
          '33%': { content: '".."' },
          '66%': { content: '"..."' },
        }
      },
      // Animation utilities
      animation: {
        'toolbarFadeIn': 'toolbarFadeIn 0.15s ease-out',
        'colorPickerFadeIn': 'colorPickerFadeIn 0.15s ease-out',
        'themeRefresh': 'themeRefresh 0.3s ease',
        'loading': 'loading 1.5s ease-in-out infinite',
        'blink': 'blink 1s ease-in-out infinite',
        'dots': 'dots 1.6s steps(4, end) infinite',
        'fadeInTranslation': 'fadeInTranslation 0.5s ease',
        'ellipsis': 'ellipsis 1.5s infinite',
      },
    },
  },
  plugins: [
    // Custom scrollbar plugin
    function({ addUtilities }) {
      const newUtilities = {
        '.scrollbar-custom': {
          'scrollbar-width': 'thin',
          'scrollbar-color': 'var(--readlite-scrollbar-thumb) var(--readlite-scrollbar-track)',
          '&::-webkit-scrollbar': {
            width: '5px',
            height: '5px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'var(--readlite-scrollbar-track)',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'var(--readlite-scrollbar-thumb)',
            borderRadius: '4px',
            '&:hover': {
              background: 'var(--readlite-scrollbar-thumb)',
              opacity: '0.8',
            },
          },
        },
      };
      addUtilities(newUtilities, ['responsive']);
    },

    // Translation styles plugin
    function({ addUtilities }) {
      const translationUtilities = {
        '.readlite-translating': {
          'opacity': '0.9',
          'position': 'relative',
        },
        '.readlite-original-text': {
          'margin-bottom': '4px',
          'position': 'relative',
        },
        '.readlite-separator': {
          'display': 'none',
        },
        '.readlite-separator-line': {
          'display': 'none',
        },
        '.readlite-translation': {
          'background-color': 'rgba(var(--readlite-bg-secondary-rgb), 0.6)',
          'color': 'var(--readlite-text-accent)',
          'margin-top': '4px',
          'padding': '8px 10px',
          'border-radius': '4px',
          'font-style': 'normal',
          'position': 'relative',
          'box-shadow': '0 1px 2px rgba(0,0,0,0.03)',
          'transition': 'all 0.2s ease',
          'border-left': '2px solid var(--readlite-accent)',
          'line-height': '1.5',
          'animation': 'fadeInTranslation 0.5s ease',
        },
        '.readlite-translation::before': {
          'display': 'none',
        },
        '.readlite-translating-indicator::after': {
          'content': '"..."',
          'animation': 'ellipsis 1.5s infinite',
        },
        '.readlite-translating-indicator::before': {
          'content': 'attr(data-i18n-translating)',
        },
        '.readlite-translation-error': {
          'color': 'var(--readlite-error)',
          'background-color': 'rgba(255, 235, 235, 0.8)',
          'border-left-color': 'var(--readlite-error)',
        },
        '.readlite-translation-error::before': {
          'content': 'attr(data-i18n-error)',
          'color': 'var(--readlite-error)',
        },
      };
      addUtilities(translationUtilities);
    },

    // Simplified scrollbar styles matching global.css
    function({ addUtilities, theme }) {
      const scrollbarUtilities = {
        '.scrollbar': {
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(156, 163, 175, 0.3)',
            borderRadius: '3px',
            '&:hover': {
              backgroundColor: 'rgba(156, 163, 175, 0.5)',
            },
          },
        },
        '.dark .scrollbar::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(75, 85, 99, 0.5)',
          '&:hover': {
            backgroundColor: 'rgba(75, 85, 99, 0.7)',
          },
        },
      };
      addUtilities(scrollbarUtilities);
    },

    // Add eyecare theme variant plugin
    function({ addVariant }) {
      addVariant('eyecare', '[data-theme="eyecare"] &');
    },

    function({ addUtilities }) {
      const highlightUtilities = {
        '.readlite-highlight': {
          'display': 'inline !important',
          'white-space': 'inherit !important',
          'box-decoration-break': 'clone',
          '-webkit-box-decoration-break': 'clone',
          'border-radius': '2px',
          'padding': '1px 0',
          'margin': '0 -1px',
          'cursor': 'pointer',
          'transition': 'background-color 0.2s ease',
          'position': 'relative',
          'text-decoration': 'none !important',
        },
        '.readlite-highlight-beige': {
          'background-color': 'var(--readlite-highlight-beige) !important',
        },
        '.readlite-highlight-cyan': {
          'background-color': 'var(--readlite-highlight-cyan) !important',
        },
        '.readlite-highlight-lavender': {
          'background-color': 'var(--readlite-highlight-lavender) !important',
        },
        '.readlite-highlight-olive': {
          'background-color': 'var(--readlite-highlight-olive) !important',
        },
        '.readlite-highlight-peach': {
          'background-color': 'var(--readlite-highlight-peach) !important',
        },
        '.readlite-highlight': {
          'background-color': 'var(--readlite-highlight-selection)',
          'padding': '1px 0',
          'border-radius': '2px',
          'transition': 'background-color 0.3s ease',
        },
        '.readlite-highlight:hover': {
          'background-color': 'var(--readlite-highlight-selection-hover)',
        },
      };
      addUtilities(highlightUtilities);
    },
  ],
} 