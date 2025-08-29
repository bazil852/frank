'use client';

import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  // Defensive check to prevent SSR issues
  if (!theme) {
    return (
      <div className="p-3 rounded-2xl bg-slate-100 w-11 h-11">
        <div className="w-5 h-5 bg-slate-300 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <motion.button
      onClick={toggleTheme}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="relative p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors duration-200 group"
      aria-label="Toggle theme"
    >
      <motion.div
        initial={false}
        animate={{ 
          rotate: theme === 'dark' ? 180 : 0,
          scale: theme === 'dark' ? 0.8 : 1
        }}
        transition={{ 
          type: "spring", 
          stiffness: 200, 
          damping: 20 
        }}
        className="relative w-5 h-5"
      >
        <motion.div
          animate={{ 
            opacity: theme === 'dark' ? 0 : 1,
            rotate: theme === 'dark' ? -90 : 0
          }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0"
        >
          <Sun 
            size={20} 
            className="text-amber-500 group-hover:text-amber-600 transition-colors" 
          />
        </motion.div>
        
        <motion.div
          animate={{ 
            opacity: theme === 'dark' ? 1 : 0,
            rotate: theme === 'dark' ? 0 : 90
          }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0"
        >
          <Moon 
            size={20} 
            className="text-slate-300 group-hover:text-white transition-colors" 
          />
        </motion.div>
      </motion.div>
    </motion.button>
  );
}