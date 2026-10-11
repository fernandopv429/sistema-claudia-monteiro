/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7f9",
          100: "#d9ebf0",
          200: "#b3d7e1",
          300: "#80bdcd",
          400: "#4a9cb5",
          500: "#1c7293",
          600: "#15607d",
          700: "#124d65",
          800: "#103f53",
          900: "#0d3443",
        },
        ink: {
          900: "#21295c",
          800: "#2a3270",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
