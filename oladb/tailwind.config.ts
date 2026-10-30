import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: { colors: { ink: '#10213c', brand: '#315bff', mist: '#f4f7fc' } } },
  plugins: []
} satisfies Config;
