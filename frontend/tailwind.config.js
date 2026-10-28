/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#090D16",
        "navy-glow": "#0A1128",
        "cyan-glow": "#00F0FF",
        "emerald-shield": "#10B981",
        "violet-accent": "#8B5CF6",
      },
      boxShadow: {
        "glow-cyan": "0 0 20px rgba(0, 240, 255, 0.25)",
        "glow-shield": "0 0 25px rgba(16, 185, 129, 0.3)",
        "glow-violet": "0 0 24px rgba(139, 92, 246, 0.28)",
        "glass-inset": "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
      },
      backdropBlur: {
        glass: "16px",
      },
      backgroundImage: {
        "cyber-grid":
          "linear-gradient(rgba(0, 240, 255, 0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.045) 1px, transparent 1px)",
      },
      backgroundSize: {
        "cyber-grid": "48px 48px",
      },
    },
  },
  plugins: [],
};
