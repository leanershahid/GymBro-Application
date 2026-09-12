/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './index.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
 theme: {
    extend: {
      colors: {
        // Surfaces
        bg:      '#0A0F0A', // app background
        surface: '#151915', // card / surface
        elevated:'#1C211C', // elevated surface

        // Input-specific (used directly by FormFields.tsx)
        input:       '#151915', // default input background
        inputActive: '#151915', // focused input background (bg stays flat; border signals focus)

        // Borders / dividers
        line:       '#242B24', // default border
        lineBright: '#7ED321', // focused border (accent)
        lineSubtle: '#1C211C', // hairline / divider

        // Text
        sub:   '#AAB2AA', // secondary text / labels
        faint: '#6B726B', // helper / tertiary text

        // Accent — green → gold gradient (see theme.ts `brandGradient` for LinearGradient usage)
        brand:     '#7ED321', // CTA / accent green
        brandDark: '#5FA317', // pressed/hover state for accent
        brandGold: '#FFC107', // gradient second stop

        // Secondary accents for health metrics
        rose:   '#FF4D6D', // heart rate
        sky:    '#4DA6FF', // water / sleep
        violet: '#9B7EF0', // sleep
      },
    },
  },
  plugins: [],
};


