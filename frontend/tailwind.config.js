/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--bg-canvas-rgb) / <alpha-value>)",
        surface: "rgb(var(--bg-surface-rgb) / <alpha-value>)",
        elevated: "rgb(var(--bg-elevated-rgb) / <alpha-value>)",
        glass: "var(--bg-glass)",
        "border-subtle": "var(--border-subtle)",
        "border-hover": "var(--border-hover)",
        ink: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          soft: "var(--accent-soft)",
          border: "var(--accent-border)",
        },
        brand: {
          DEFAULT: "#A855F7",
          hover: "#9333EA",
          soft: "rgba(168, 85, 247, 0.15)",
          border: "rgba(168, 85, 247, 0.4)",
          indigo: "#6366F1",
        },
        reader: {
          bg: "var(--reader-bg)",
          text: "var(--reader-text)",
          muted: "var(--reader-muted)",
          surface: "var(--reader-surface)",
          border: "var(--reader-border)",
        },
      },
      borderColor: {
        subtle: "var(--border-subtle)",
        hover: "var(--border-hover)",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: ["var(--font-cinzel)", "Georgia", "serif"],
        serif: [
          "var(--font-lora)",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "serif",
        ],
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "fade-out": "fade-out 150ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "slide-up": "slide-up 240ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "slide-down": "slide-down 240ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "scale-in": "scale-in 180ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
        shimmer: "shimmer 1.8s ease-in-out infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
