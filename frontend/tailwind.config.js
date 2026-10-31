/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
    "./src/data/**/*.{js,jsx}",
    "./src/lib/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        canvas: "#F6F7F9",
        brand: {
          50: "#EEF4FB",
          100: "#DDE9F7",
          500: "#4F79AD",
          600: "#3A659D",
          700: "#2E5488",
          900: "#17283E"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.06)"
      }
    }
  },
  plugins: []
};
