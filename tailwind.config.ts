import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0A0B0F',
          surface: 'rgba(18, 20, 28, 0.78)',
          primary: '#C9A962',
          text: '#E8E4DF',
          muted: '#6B6B7D',
          border: '#2A2D3A',
        },
        light: {
          bg: '#F6F5F2',
          surface: '#FFFFFF',
          primary: '#2563EB',
          text: '#1A1814',
          muted: '#8B8B8B',
          border: '#E5E3E0',
        },
        duty: {
          work: '#7EB8C4',
          vacation: '#E5A84B',
          pikett: '#B8A8E0',
          double: '#6EC49E',
          sick: '#D4706E',
          military: '#8B8578',
        },
      },
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-in-out',
        'slide-in-up': 'slide-in-up 0.3s ease-out',
        'slide-in-down': 'slide-in-down 0.3s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
