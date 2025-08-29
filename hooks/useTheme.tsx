'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check localStorage for saved theme preference
    const savedTheme = localStorage.getItem('frank-theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    localStorage.setItem('frank-theme', theme);
    console.log(`Applying theme: ${theme}`);
    
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      console.log('Added dark class to html element');
    } else {
      document.documentElement.classList.remove('dark');
      console.log('Removed dark class from html element');
    }
    
    // Debug: Check if class was applied
    console.log('Current html classes:', document.documentElement.classList.toString());
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      console.log(`Theme toggled from ${prev} to ${newTheme}`);
      return newTheme;
    });
  };

  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ theme: 'light', toggleTheme: () => {} }}>
        <div className="min-h-screen bg-slate-50">{children}</div>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}