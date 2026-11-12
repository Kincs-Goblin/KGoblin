/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.php",
    "./woocommerce/**/*.php",
    "./inc/**/*.php",
    "./assets/js/**/*.js",
    "../../plugins/hu-webshop-core/**/*.php"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#1e1b4b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
