/** @type {import('tailwindcss').Config} */
export default {
  content: ['./converter/index.html', './converter/src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111827',
        paper: '#f8fafc',
        mint: '#0f766e',
        ember: '#b45309',
      },
      boxShadow: {
        soft: '0 20px 50px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
}
