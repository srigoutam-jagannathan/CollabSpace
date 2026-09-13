// @testing-library/react-native v13+ registers its jest matchers
// automatically when the package's main entry point is loaded (which
// happens as soon as anything in a test imports from
// "@testing-library/react-native"), so there is no separate
// "/extend-expect" subpath to require here.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium", Heavy: "Heavy" },
  NotificationFeedbackType: { Success: "Success", Error: "Error", Warning: "Warning" },
}));

// react-native-safe-area-context's useSafeAreaInsets() throws without a
// <SafeAreaProvider> ancestor, and rendering a bare SafeAreaProvider in
// tests doesn't help either — its onLayout never fires under the test
// renderer, so it silently never renders its children. The library ships
// an official jest mock that returns zeroed insets/frame instead. That
// mock module only has a default export (its named exports — SafeAreaView,
// useSafeAreaInsets, etc. — live on `.default`), so it must be unwrapped
// here or every named import from "react-native-safe-area-context" in
// tests resolves to undefined.
jest.mock("react-native-safe-area-context", () => {
  const mock = require("react-native-safe-area-context/jest/mock");
  return mock.default ?? mock;
});

// Tests that need the real provider/hook behavior (e.g. testing a
// theme-switching flow) can opt out per-file with:
//   jest.unmock("@/contexts/ThemeContext");
//   const { ThemeProvider, useTheme } = jest.requireActual("@/contexts/ThemeContext");
jest.mock("@/contexts/ThemeContext", () => {
  const { DARK_THEME } = require("@/utils/theme");
  return {
    useTheme: () => ({ mode: "dark", tokens: DARK_THEME, setMode: jest.fn() }),
    ThemeProvider: ({ children }) => children,
  };
});
