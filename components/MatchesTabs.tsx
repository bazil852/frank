'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface MatchesTabsProps {
  availableCount: number;
  filteredCount: number;
  closeMatchCount: number;
  activeTab: 'available' | 'filtered' | 'close';
  onTabChange: (tab: 'available' | 'filtered' | 'close') => void;
}

export default function MatchesTabs({
  availableCount,
  filteredCount,
  closeMatchCount,
  activeTab,
  onTabChange,
}: MatchesTabsProps) {
  const tabs = [
    { id: 'available', label: `Available`, count: availableCount, color: 'brand' },
    { id: 'close', label: `Close`, count: closeMatchCount, color: 'amber' },
    { id: 'filtered', label: `Filtered`, count: filteredCount, color: 'slate' },
  ];

  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
  
  return (
    <div className="relative border-b border-slate-200 dark:border-slate-700 transition-colors duration-200">
      <div className="flex gap-1 bg-slate-50 dark:bg-slate-700 rounded-2xl p-1 transition-colors duration-200">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => onTabChange(tab.id as 'available' | 'filtered' | 'close')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`relative flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === tab.id 
                ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-600/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.id 
                  ? tab.color === 'brand' ? 'bg-brand-100 text-brand-700' :
                    tab.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-200 text-slate-700'
                  : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
              }`}>
                {tab.count}
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}