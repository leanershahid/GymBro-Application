// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'web-build/*', '.expo/*', 'node_modules/*'],
  },
  {
    rules: {
      // Stale-closure bugs (ARCH-064) — keep these loud.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // React Compiler rules (react-hooks v7). The codebase predates them — warnings for now so
      // `npm run lint` can gate CI on errors; tighten to 'error' as screens are cleaned up.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      // React Native <Text> renders apostrophes/quotes literally; escaping is a web-DOM concern.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
