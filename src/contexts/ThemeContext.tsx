import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DARK_THEME, LIGHT_THEME, ThemeTokens } from "@/utils/theme";

export type ThemeMode = "dark" | "light";

type ThemeContextValue = {
  mode: ThemeMode;
  tokens: ThemeTokens;
  setMode: (mode: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_KEY = "theme_mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === "dark" || stored === "light") {
        setModeState(stored);
      } else {
        const sys = Appearance.getColorScheme();
        setModeState(sys === "light" ? "light" : "dark");
      }
      setResolved(true);
    });

    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      AsyncStorage.getItem(THEME_KEY).then((stored) => {
        if (!stored) setModeState(colorScheme === "light" ? "light" : "dark");
      });
    });
    return () => sub.remove();
  }, []);

  const setMode = useCallback(async (next: ThemeMode) => {
    setModeState(next);
    await AsyncStorage.setItem(THEME_KEY, next);
  }, []);

  if (!resolved) return null;

  return (
    <ThemeContext.Provider
      value={{ mode, tokens: mode === "dark" ? DARK_THEME : LIGHT_THEME, setMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
