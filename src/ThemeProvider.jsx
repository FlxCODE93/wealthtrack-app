import React, { createContext, useContext, useEffect } from "react";
import { C } from "./theme.js";
import { storage } from "./storage.js";

export const ThemeContext = createContext();
export const ThemeOverrideContext = createContext(null);

// Thème sombre uniquement (Luxe Institutionnel). Aucun white mode possible.
export const ThemeProvider = ({ children }) => {
  const isDark = true;

  useEffect(() => {
    try {
      storage.set("wealthtrack-theme", "dark");
      document.documentElement.style.colorScheme = "dark";
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.style.backgroundColor = C.bg;
    } catch {}
  }, []);

  // Conservé pour compatibilité d'API (anciens appelants) — sans effet.
  const toggleTheme = () => {};

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, theme: C }}>
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

export const useT = () => useContext(ThemeOverrideContext) ?? C;
