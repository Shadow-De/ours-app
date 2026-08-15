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
        // Dark Neon Palette
        background: "#0F1210",
        surface: "#1B1F1C",
        "surface-raised": "#232823",
        primary: "#F5F7F3",
        muted: "#8F968F",
        "partner-a": "#C9F24C",
        "partner-b": "#4CE0C9",
        "shared-gold": "#E8D24C",
        alert: "#FF6B5C",
        border: "#2A302A",
        input: "#2A302A",
        ring: "#C9F24C",

        // Aliases to avoid breaking current usage before global replace
        paper: "#0F1210",
        ink: "#F5F7F3",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "Consolas", "monospace"],
      },
      borderRadius: {
        lg: "1.75rem", // 28px
        md: "1.25rem", // 20px
        sm: "0.75rem", // 12px
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
