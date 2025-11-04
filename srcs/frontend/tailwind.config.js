/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./**/*.html",
    "./*.html",
    "./src/**/*.ts",
    "./src/**/*.css"
  ],
  theme: {
    extend: {
      fontFamily: {
        'press-start': ['"Press Start 2P"', 'cursive'],
      },
    },
  },
  safelist: [
    'font-press-start'
  ],
  plugins: [],
}