import React, { createContext, useState, useEffect, useCallback } from "react";

export const ThemeContext = createContext();

const DARK_THEME = {
  bg: "#0f172a",
  bgGradient: "linear-gradient(to bottom, #0f172a, #1a1f2e)",
  panel: "#222735",
  border: "rgba(255,255,255,0.08)",
  text: "#ffffff",
  muted: "rgba(255,255,255,0.4)",
  blue: "#3b82f6",
  amber: "#f59e0b",
  violet: "#8b5cf6",
  cyan: "#0891b2",
  green: "#22c55e",
  red: "#ef4444",
};

const LIGHT_THEME = {
  bg: "#ffffff",
  bgGradient: "linear-gradient(to bottom, #ffffff, #f8fafc)",
  panel: "#f1f5f9",
  border: "rgba(0,0,0,0.08)",
  text: "#0f172a",
  muted: "rgba(0,0,0,0.5)",
  blue: "#3b82f6",
  amber: "#f59e0b",
  violet: "#8b5cf6",
  cyan: "#0891b2",
  green: "#22c55e",
  red: "#ef4444",
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem("wealthtrack-theme");
      if (stored) return JSON.parse(stored) === "dark";
      return true; // Default to dark
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("wealthtrack-theme", JSON.stringify(isDark ? "dark" : "light"));

      // Update document background
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
      if (isDark) {
        document.documentElement.style.backgroundColor = DARK_THEME.bg;
      } else {
        document.documentElement.style.backgroundColor = LIGHT_THEME.bg;
      }
    } catch {}
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  const currentTheme = isDark ? DARK_THEME : LIGHT_THEME;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, theme: currentTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
