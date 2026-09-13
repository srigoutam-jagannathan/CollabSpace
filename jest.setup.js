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
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
  NotificationFeedbackType: { Success: "Success", Error: "Error" },
}));

jest.mock("@/contexts/ThemeContext", () => {
  const { DARK_THEME } = require("@/utils/theme");
  return {
    useTheme: () => ({ mode: "dark", tokens: DARK_THEME, setMode: jest.fn() }),
    ThemeProvider: ({ children }) => children,
  };
});
