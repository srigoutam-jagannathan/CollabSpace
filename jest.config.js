module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|nativewind|react-native-css-interop|@shopify/flash-list))",
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "app/**/*.{ts,tsx}",
    "!**/*.test.{ts,tsx}",
    // Test infrastructure is not product code.
    "!src/test/**",
    // Type-only modules have no statements; they only add noise to the report.
    "!src/types/**",
    "!src/**/types.ts",
  ],
  // Ratchet. Each phase of docs/superpowers/plans/2026-10-01-test-coverage.md
  // raises these to the floor of what it achieved. Never lower them to pass.
  coverageThreshold: {
    global: { statements: 8, branches: 5, functions: 9, lines: 9 },
  },
};
