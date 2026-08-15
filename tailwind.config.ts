import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core palette — Section 9
        paper: "#F7F5F0",
        ink: "#232220",
        "partner-a": "#2F6E62",
        "partner-b": "#5B5296",
        "shared-gold": "#C99A3C",
        alert: "#B24C32",
        // Semantic aliases
        background: "#F7F5F0",
        foreground: "#232220",
        primary: {
          DEFAULT: "#2F6E62",
          foreground: "#F7F5F0",
        },
        secondary: {
          DEFAULT: "#5B5296",
          foreground: "#F7F5F0",
        },
        accent: {
          DEFAULT: "#C99A3C",
          foreground: "#232220",
        },
        destructive: {
          DEFAULT: "#B24C32",
          foreground: "#F7F5F0",
        },
        muted: {
          DEFAULT: "#EBE9E3",
          foreground: "#6B6865",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#232220",
        },
        border: "#DDD9D2",
        input: "#DDD9D2",
        ring: "#2F6E62",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "Consolas", "monospace"],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "braid-shimmer": {
          "0%": { strokeDashoffset: "100%" },
          "100%": { strokeDashoffset: "0%" },
        },
        "progress-fill": {
          from: { width: "0%" },
          to: { width: "var(--progress-width)" },
        },
        "celebrate-scale": {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "60%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        "slide-up": "slide-up 250ms ease-out",
        "progress-fill": "progress-fill 600ms ease-out",
        "celebrate-scale": "celebrate-scale 400ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
