module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  // Edge Functions are Deno code with Deno tests (`deno test supabase/functions/`).
  // supabase/functions is Deno; .claude/worktrees holds other checkouts of this repo.
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/supabase/functions/", "<rootDir>/.claude/"],
  modulePathIgnorePatterns: ["<rootDir>/.claude/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|nativewind|react-native-css-interop|@shopify/flash-list|standard-navigation))",
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
  // Ratchet: raise these to the floor of what coverage reaches. Never lower them to pass.
  coverageThreshold: {
    // Floors of the measured results. Raise whenever coverage rises; never lower.
    // Jest excludes the per-path files below from "global", so these are floors of the rest.
    global: { statements: 19, branches: 14, functions: 16, lines: 20 },
    // What guards sign-in, membership and navigation is held near-total.
    "./src/features/auth/constants.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
    "./src/features/auth/AuthContext.tsx": { statements: 100, branches: 100, functions: 100, lines: 100 },
    "./src/features/notifications/pending.ts": { statements: 95, branches: 58, functions: 100, lines: 95 },
    "./src/components/CollabTabBar.tsx": { statements: 85, branches: 75, functions: 80, lines: 85 },
  },
};
