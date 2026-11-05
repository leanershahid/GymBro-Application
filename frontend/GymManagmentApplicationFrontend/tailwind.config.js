// Colours come from the same file as src/theme.ts `T`, so the two can't drift.
const C = require('./src/theme.colors.json');

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
      // Generated from src/theme.colors.json — the same values as `T` in src/theme.ts (ARCH-127).
      // Class names are kept for existing markup (e.g. `text-sub` = T.textSub).
      colors: {
        // Surfaces
        bg:          C.bg,
        surface:     C.bgInput,
        elevated:    C.bgInputActive,
        input:       C.bgInput,
        inputActive: C.bgInputActive,

        // Borders / dividers
        line:       C.line,
        lineBright: C.lineBright,
        lineSubtle: C.lineSubtle,

        // Text
        sub:      C.textSub,
        faint:    C.textFaint,
        disabled: C.textDisabled,

        // Accent (see theme.ts `brandGradient` for LinearGradient usage)
        brand:     C.brand,
        brandDark: C.brandDark,
        brandGold: C.brandGold,
        logoLime:  C.logoLime,
        logoDeep:  C.logoDeep,

        // Secondary accents for health metrics
        rose:   C.rose,
        sky:    C.sky,
        violet: C.violet,

        // Status
        ok:  C.ok,
        err: C.err,

        // Bottom tab bars
        nav: C.bgNav,
      },
    },
  },
  plugins: [],
};


