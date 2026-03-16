
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  presets: [require('@spartan-ng/brain/hlm-tailwind-preset')],
  content: [
    './src/**/*.{html,ts}',
    './libs/ui/**/*.{html,ts}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'curim-header': 'linear-gradient(135deg, rgba(7, 0, 37, 0.75) 0%, rgba(2, 171, 116, 0.65) 100%)',
        'curim-header-scrolled': 'linear-gradient(135deg, rgba(7, 0, 37, 0.9) 0%, rgba(2, 171, 116, 0.8) 100%)',
      },
    },
  },
  plugins: [],
};
