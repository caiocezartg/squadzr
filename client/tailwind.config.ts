import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0B',
        surface: {
          DEFAULT: '#141416',
          hover: '#1A1A1D',
          light: '#1E1E22',
        },
        border: {
          DEFAULT: '#1F1F23',
          light: '#2A2A2F',
        },
        accent: {
          DEFAULT: '#00FFA2',
          hover: '#00E694',
          muted: 'rgba(0, 255, 162, 0.1)',
          glow: 'rgba(0, 255, 162, 0.15)',
        },
        muted: {
          DEFAULT: '#8A8A8E',
          light: '#A0A0A4',
        },
        offwhite: '#F0F0F0',
        discord: '#5865F2',
        danger: {
          DEFAULT: '#EF4444',
          hover: '#DC2626',
        },
      },
      fontFamily: {
        heading: ['"Exo 2"', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0, 255, 162, 0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 255, 162, 0.4)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
