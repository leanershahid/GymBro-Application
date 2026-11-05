/** Unit tests (ARCH-065). `npm test` — jest-expo picks the iOS/Android-like RN environment. */
module.exports = {
  preset: 'jest-expo',
  // expo-modules-core is installed nested under expo/ (not hoisted); jest-expo's setup needs it.
  moduleDirectories: ['node_modules', '<rootDir>/node_modules/expo/node_modules'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts?(x)', '<rootDir>/src/**/*.test.ts?(x)'],
  // Transform the RN / Expo packages that ship untranspiled ESM.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop)',
  ],
};
