/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        eink: {
          'black': '#000000',
          'dark-gray': '#333333',
          'gray': '#666666',
          'light-gray': '#999999',
          'pale-gray': '#cccccc',
          'off-white': '#f5f5f5',
          'white': '#ffffff',
        }
      },
      fontFamily: {
        'mono': ['Courier New', 'monospace'],
        'serif': ['Times New Roman', 'serif'],
        'sans': ['Helvetica', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}