"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Default to dark mode
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Load theme from localStorage on mount (respect user's previous choice)
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    // Only switch to light if user explicitly chose light mode before
    if (savedTheme === "light") {
      setIsDarkMode(false);
    }
    // If no saved preference or "dark", keep dark mode (the default)
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
