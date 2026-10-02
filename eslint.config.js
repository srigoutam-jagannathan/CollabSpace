// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions is Deno code: URL imports Node's resolver cannot follow.
    ignores: ["dist/*", "supabase/functions/**"],
  },
  {
    files: ["jest.setup.js", "**/*.test.{ts,tsx}", "src/test/**"],
    languageOptions: { globals: globals.jest },
  },
  {
    rules: {
      // React Compiler advisories. The compiler is not enabled in app.json,
      // and every hit is the fetch-on-mount pattern. Visible, not blocking.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
]);
