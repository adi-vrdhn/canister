/**
 * FilmShare Retro Dark Edition Tailwind Config
 * All color tokens mapped for easy use in your components.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-main': '#0D0D0D',
        'bg-secondary': '#161616',
        'bg-card': '#1E1E1E',
        'bg-hover': '#262626',
        'gold-primary': '#D4AF37',
        'gold-soft': '#C5A84A',
        'retro-yellow': '#F4D35E',
        'retro-red': '#EE6C4D',
        'retro-teal': '#2EC4B6',
        'retro-pink': '#F28482',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A0A0A0',
        'text-muted': '#6B6B6B',
        'border-subtle': '#2A2A2A',
      },
    },
  },
  plugins: [],
};
