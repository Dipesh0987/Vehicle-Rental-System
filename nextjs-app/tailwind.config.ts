import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        manrope: ['Manrope', 'sans-serif'],
        playfair: ['Playfair Display', 'serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        ink: 'var(--public-ink)',
        accent: 'var(--public-accent)',
        panel: 'var(--public-brand)',
        paper: 'var(--public-surface)',
        muted: 'var(--vrs-muted)',
        brand: {
          50: '#f0fdf9',
          100: '#ccfbef',
          200: '#99f6e0',
          300: '#5fe9cd',
          400: '#2dd4b5',
          500: '#1f7668',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
      },
      boxShadow: {
        soft: '0 4px 20px rgba(0, 0, 0, 0.08)',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        floatIn: {
          from: { opacity: '0', transform: 'translateY(24px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        carEntry: {
          from: { opacity: '0', transform: 'translateX(60px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        panelReveal: {
          from: { opacity: '0', transform: 'scaleX(0.92)' },
          to: { opacity: '1', transform: 'scaleX(1)' },
        },
        logoIn: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        logoGlow: {
          '0%, 100%': { opacity: '0.75' },
          '50%': { opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.75' },
          '50%': { opacity: '1' },
        },
        drift: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '50%': { transform: 'translate(12px, -8px)' },
        },
        loginStageIn: {
          from: { opacity: '0', transform: 'translateY(18px) scale(0.985)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        loginSectionIn: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        vehicleReveal: {
          from: { opacity: '0', transform: 'translateY(16px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        vehicleFloat: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        accentPulse: {
          '0%, 100%': { transform: 'scaleX(1)', opacity: '0.7' },
          '50%': { transform: 'scaleX(1.15)', opacity: '1' },
        },
        sectionIn: {
          from: { opacity: '0', transform: 'translateY(16px) scale(0.985)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        stageIn: {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 600ms cubic-bezier(0.22,1,0.36,1) both',
        floatIn: 'floatIn 700ms cubic-bezier(0.22,1,0.36,1) both',
        carEntry: 'carEntry 800ms cubic-bezier(0.22,1,0.36,1) 300ms both',
        panelReveal: 'panelReveal 600ms cubic-bezier(0.22,1,0.36,1) both',
        logoIn: 'logoIn 500ms ease both',
        logoGlow: 'logoGlow 3s ease-in-out infinite',
        glowPulse: 'glowPulse 3s ease-in-out infinite',
        drift: 'drift 8s ease-in-out infinite',
        loginStageIn: 'loginStageIn 760ms cubic-bezier(0.2,1,0.22,1) forwards',
        loginSectionIn: 'loginSectionIn 600ms ease forwards',
        vehicleReveal: 'vehicleReveal 700ms cubic-bezier(0.22,1,0.36,1) both',
        vehicleFloat: 'vehicleFloat 4s ease-in-out infinite',
        accentPulse: 'accentPulse 3s ease-in-out infinite',
        sectionIn: 'sectionIn 700ms cubic-bezier(0.22,1,0.36,1) forwards',
        stageIn: 'stageIn 520ms cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};
export default config;
