/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        base: {
          950: "#12100d",
          900: "#1c1814",
          800: "#302a23",
          700: "#443b31",
          600: "#605446",
        },
        brand: {
          300: "#e8a06a",
          400: "#d97a3a",
          500: "#c46228",
          600: "#a84e1e",
        },
        accent: {
          400: "#a8b88c",
          500: "#8a9e6c",
        },
        danger: {
          400: "#e07a72",
          500: "#c4544c",
        },
        warn: {
          400: "#e0b15a",
        },
        slate: {
          100: "#f5ece0",
          200: "#e2d6c6",
          300: "#c4b4a0",
          400: "#9e8e7a",
          500: "#786a5a",
          600: "#5a4e42",
        },
      },
      fontFamily: {
        sans: [
          "Avenir Next",
          "Segoe UI",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "Pretendard",
          "system-ui",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
