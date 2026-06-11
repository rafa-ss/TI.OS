/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  safelist: [
    // gerados dinamicamente nos StatCards
    'bg-brand-100','text-brand-700','dark:bg-brand-900/30','dark:text-brand-300',
    'bg-pref-azul-100','text-pref-azul-700','dark:bg-pref-azul-900/30','dark:text-pref-azul-300',
    'bg-pref-vermelho-100','text-pref-vermelho-700','dark:bg-pref-vermelho-900/30','dark:text-pref-vermelho-300',
    'bg-pref-amarelo-100','text-pref-amarelo-700','dark:bg-pref-amarelo-900/30','dark:text-pref-amarelo-300',
    'bg-pref-verde-100','text-pref-verde-700','dark:bg-pref-verde-900/30','dark:text-pref-verde-300',
    'bg-sky-100','text-sky-700','dark:bg-sky-900/30','dark:text-sky-300',
    'bg-emerald-100','text-emerald-700','dark:bg-emerald-900/30','dark:text-emerald-300',
    'bg-amber-100','text-amber-700','dark:bg-amber-900/30','dark:text-amber-300',
    'bg-rose-100','text-rose-700','dark:bg-rose-900/30','dark:text-rose-300',
    'bg-indigo-100','text-indigo-700','dark:bg-indigo-900/30','dark:text-indigo-300',
    'bg-teal-100','text-teal-700','dark:bg-teal-900/30','dark:text-teal-300',
    'bg-violet-100','text-violet-700','dark:bg-violet-900/30','dark:text-violet-300',
    'bg-blue-100','text-blue-700','dark:bg-blue-900/30','dark:text-blue-300',
    'bg-orange-100','text-orange-700','dark:bg-orange-900/30','dark:text-orange-300',
    // variantes extras usadas no Dashboard NOC (MiniStat / pulse)
    'bg-sky-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-indigo-500','bg-orange-500',
    'bg-sky-50/40','bg-emerald-50/40','bg-amber-50/40','bg-rose-50/40','bg-indigo-50/40','bg-orange-50/40',
    'dark:bg-sky-900/10','dark:bg-emerald-900/10','dark:bg-amber-900/10','dark:bg-rose-900/10','dark:bg-indigo-900/10','dark:bg-orange-900/10',
  ],
  theme: {
    extend: {
      colors: {
        // === Paleta oficial da Prefeitura de Abaetetuba ===
        // Cor principal: azul escuro do brasão (PREFEITURA MUNICIPAL DE)
        brand: {
          50:  '#eff5ff',
          100: '#dbe7ff',
          200: '#b6cdff',
          300: '#85a8ff',
          400: '#587fff',
          500: '#1e40af',  // azul "PREFEITURA"
          600: '#1e3a8a',  // azul escuro principal
          700: '#1c3478',
          800: '#172c63',
          900: '#0f1e44',
        },
        'pref-azul': {
          50:  '#eff5ff',
          100: '#dbe7ff',
          200: '#b6cdff',
          300: '#85a8ff',
          400: '#587fff',
          500: '#1e40af',
          600: '#1e3a8a',
          700: '#1c3478',
          800: '#172c63',
          900: '#0f1e44',
        },
        // Vermelho do "ABAETETUBA"
        'pref-vermelho': {
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#e11d2c',  // vermelho "ABAETETUBA"
          600: '#c81527',
          700: '#a01021',
          800: '#7e0a1a',
          900: '#5b0613',
        },
        // Amarelo das fitas
        'pref-amarelo': {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Verde das fitas
        'pref-verde': {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
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