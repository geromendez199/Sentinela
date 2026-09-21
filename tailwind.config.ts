import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        risk: {
          low: '#15803d',
          medium: '#a16207',
          high: '#c2410c',
          critical: '#b91c1c',
        },
      },
    },
  },
  plugins: [],
};

export default config;
