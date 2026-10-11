/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          // Laranja da marca FV Advogados (amostrado do logo).
          50: "#fff3ec",
          100: "#ffe1d0",
          200: "#ffc3a1",
          300: "#ffa06d",
          400: "#fc8148",
          500: "#f6692a",
          600: "#db4f14",
          700: "#b23d0f",
          800: "#8a2f0d",
          900: "#6b250b",
        },
        ink: {
          900: "#1a1a1a",
          800: "#2b2b2b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
