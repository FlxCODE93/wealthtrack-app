import React, { createContext, useState, useEffect, useCallback } from "react";
import { C, CL } from "./theme.js";
import { storage } from "./storage.js";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const stored = storage.get("wealthtrack-theme", null);
    return stored ? stored === "dark" : true; // Défaut : sombre
  });

  useEffect(() => {
    try {
      storage.set("wealthtrack-theme", isDark ? "dark" : "light");

      // Update document background
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
      document.documentElement.style.backgroundColor = isDark ? C.bg : CL.bg;
    } catch {}
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  const currentTheme = isDark ? C : CL;

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

export const useT = () => {
  const { isDark } = React.useContext(ThemeContext);
  return isDark ? C : CL;
};
