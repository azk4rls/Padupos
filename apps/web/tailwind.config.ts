import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#f8fafc',
        foreground: '#0f172a',
        muted: {
          DEFAULT: '#f1f5f9',
          foreground: '#64748b',
        },
        card: {
          DEFAULT: '#ffffff',
          foreground: '#0f172a',
        },
        border: '#e2e8f0',
        input: '#e2e8f0',
        primary: {
          DEFAULT: '#0f172a',
          foreground: '#ffffff',
          hover: '#1e293b',
        },
        secondary: {
          DEFAULT: '#f1f5f9',
          foreground: '#1e293b',
          hover: '#e2e8f0',
        },
        accent: {
          DEFAULT: '#2563eb',
          foreground: '#ffffff',
          hover: '#1d4ed8',
        },
        destructive: {
          DEFAULT: '#dc2626',
          foreground: '#ffffff',
          hover: '#b91c1c',
        },
        success: {
          DEFAULT: '#16a34a',
          foreground: '#ffffff',
          hover: '#15803d',
        },
        warning: {
          DEFAULT: '#d97706',
          foreground: '#ffffff',
          hover: '#b45309',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
};

export default config;
