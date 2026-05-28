/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  // Classes geradas dinamicamente nos componentes StatCard / EquipmentStatus
  // — listadas explicitamente para não inflar o CSS final.
  safelist: [
    // Card de KPI: bg-${color}-100, text-${color}-700, dark:bg-${color}-900/30, dark:text-${color}-300
    'bg-brand-100', 'text-brand-700', 'dark:bg-brand-900/30', 'dark:text-brand-300',
    'bg-sky-100', 'text-sky-700', 'dark:bg-sky-900/30', 'dark:text-sky-300',
    'bg-emerald-100', 'text-emerald-700', 'dark:bg-emerald-900/30', 'dark:text-emerald-300',
    'bg-amber-100', 'text-amber-700', 'dark:bg-amber-900/30', 'dark:text-amber-300',
    'bg-rose-100', 'text-rose-700', 'dark:bg-rose-900/30', 'dark:text-rose-300',
    'bg-indigo-100', 'text-indigo-700', 'dark:bg-indigo-900/30', 'dark:text-indigo-300',
    'bg-teal-100', 'text-teal-700', 'dark:bg-teal-900/30', 'dark:text-teal-300',
    'bg-violet-100', 'text-violet-700', 'dark:bg-violet-900/30', 'dark:text-violet-300',
    'bg-blue-100', 'text-blue-700', 'dark:bg-blue-900/30', 'dark:text-blue-300',
    'bg-orange-100', 'text-orange-700', 'dark:bg-orange-900/30', 'dark:text-orange-300',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 24px -8px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
};
