/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './features/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#f5f5f7',
        surface: '#ffffff',
        'surface-subtle': '#ebebed',
        ink: '#1d1d1f',
        'ink-muted': '#6e6e73',
        'ink-tertiary': '#9a9aa5',
        hairline: '#d2d2d7',
        accent: '#0071e3',
        'accent-subtle': '#e8f1fb',
        destructive: '#b81c3a',
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        lg: '17px',
        xl: '20px',
      },
      fontSize: {
        'display-2xl': ['32px', { lineHeight: '40px', fontWeight: '700' }],
        'display-xl': ['24px', { lineHeight: '32px', fontWeight: '700' }],
        'display-lg': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'display-md': ['18px', { lineHeight: '26px', fontWeight: '600' }],
        'body-lg': ['17px', { lineHeight: '24px', fontWeight: '400' }],
        body: ['15px', { lineHeight: '22px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
};
