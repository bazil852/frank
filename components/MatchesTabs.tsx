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
    { id: 'available', label: `Available (${availableCount})`, width: '85px' },
    { id: 'close', label: `Close (${closeMatchCount})`, width: '75px' },
    { id: 'filtered', label: `Filtered (${filteredCount})`, width: '85px' },
  ];

  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
  
  return (
    <div className="relative border-b border-gray-200">
      <div className="flex space-x-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as 'available' | 'filtered' | 'close')}
            className={`pb-4 px-1 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <motion.div
        className="absolute bottom-0 h-0.5 bg-blue-600"
        initial={false}
        animate={{
          x: activeIndex * 91, // Approximate spacing
          width: tabs[activeIndex]?.width || '85px',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />
    </div>
  );
}