/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6f4',
          100: '#d7ebe6',
          200: '#b3d8cf',
          300: '#8ac0b3',
          400: '#5ea898',
          500: '#3d8879',
          600: '#2f6f64',
          700: '#27584f',
          800: '#1f443d',
          900: '#16312c',
        },
        paper: '#f6f8f7',
        ink: '#243b36',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(16, 42, 36, 0.06), 0 4px 14px rgba(16, 42, 36, 0.05)',
        soft: '0 2px 10px rgba(16, 42, 36, 0.08)',
      },
    },
  },
  plugins: [],
};