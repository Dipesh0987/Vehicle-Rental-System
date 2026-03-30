module.exports = {
  darkMode: "class",
  content: [
    "./frontend/**/*.{html,js}",
    "./backend/**/*.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
        sans: ["Manrope", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      colors: {
        accent: "#E58C4E",
        panel: "#2C766E",
        ink: "#0E2528",
        muted: "#6C7074",
        paper: "#F2F3F1",
        sand: "#f5f1e8",
        brand: {
          50: "#f2f7f5",
          100: "#dcece7",
          500: "#1f7668",
          600: "#185e53",
          700: "#12453d",
          900: "#0a211d",
        },
        peach: "#f08f5f",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(16, 26, 31, 0.08)",
        panel: "0 20px 45px rgba(9, 19, 23, 0.12)",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        floatIn: {
          from: { opacity: "0", transform: "translateY(16px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        panelReveal: {
          from: { opacity: "0.5", transform: "translateX(30px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        logoIn: {
          from: { opacity: "0", transform: "translateY(10px)", filter: "blur(4px)" },
          to: { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
        },
        logoGlow: {
          "0%, 100%": { opacity: "0.72" },
          "50%": { opacity: "1" },
        },
        carDrift: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        cardLift: {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        cardIn: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { opacity: "0.65" },
          "50%": { opacity: "1" },
        },
        drift: {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -8px, 0)" },
        },
        loginStageIn: {
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        loginSectionIn: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        vehicleReveal: {
          from: { opacity: "0", transform: "translateY(16px) scale(0.985)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        vehicleFloat: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        accentPulse: {
          "0%, 100%": { opacity: "0.5", transform: "scaleX(1)" },
          "50%": { opacity: "1", transform: "scaleX(1.08)" },
        },
        sectionIn: {
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(400px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseDot: {
          "0%, 100%": { transform: "scale(0.9)", opacity: "0.55" },
          "50%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        fadeUp: "fadeUp 620ms ease forwards",
        fadeIn: "fadeIn 300ms ease-out",
        floatIn: "floatIn 620ms cubic-bezier(0.19, 1, 0.22, 1) forwards",
        panelReveal: "panelReveal 760ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
        logoIn: "logoIn 760ms cubic-bezier(0.19, 1, 0.22, 1) forwards",
        logoGlow: "logoGlow 3.6s ease-in-out infinite",
        carDrift: "carDrift 6s ease-in-out 800ms infinite",
        carEntry: "floatIn 620ms cubic-bezier(0.19, 1, 0.22, 1) forwards, carDrift 6s ease-in-out 800ms infinite",
        cardLift: "cardLift 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
        cardIn: "cardIn 640ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
        glowPulse: "glowPulse 3.8s ease-in-out infinite",
        drift: "drift 8s ease-in-out infinite",
        loginStageIn: "loginStageIn 720ms cubic-bezier(0.19, 1, 0.22, 1) forwards",
        loginSectionIn: "loginSectionIn 640ms ease forwards",
        vehicleReveal: "vehicleReveal 760ms cubic-bezier(0.18, 0.88, 0.2, 1) 260ms both",
        vehicleFloat: "vehicleFloat 6.2s ease-in-out 900ms infinite",
        accentPulse: "accentPulse 3s ease-in-out infinite",
        sectionIn: "sectionIn 700ms cubic-bezier(0.19, 1, 0.22, 1) forwards",
        slideInRight: "slideInRight 300ms ease-out",
        pulseDot: "pulseDot 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
