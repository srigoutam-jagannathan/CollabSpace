/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // CollabSpace purple design system
        app: "#120a2e",          // root background
        card: "#1e1040",         // dark card / input bg
        accent: {
          DEFAULT: "#7c3aed",    // primary purple
          light: "#8b5cf6",      // lighter purple (FAB, active)
        },
        "card-yellow": "#fef08a", // project listing cards
        border: "#2d1b69",        // dividers, input borders
        muted: "rgba(255,255,255,0.45)", // secondary text
        // University brand colours — unchanged
        qub: {
          DEFAULT: "#8B0000",
          light: "#b91c1c",
        },
        uu: {
          DEFAULT: "#006E6D",
          light: "#0f766e",
        },
        // Keep surface aliases so older code doesn't break during migration
        surface: {
          DEFAULT: "#120a2e",
          card: "#1e1040",
          border: "#2d1b69",
        },
        // Keep primary alias pointing to accent for any remaining references
        primary: {
          50:  "#f5f3ff",
          100: "#ede9fe",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          900: "#2e1065",
        },
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
