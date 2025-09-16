'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface MatchesTabsProps {
  qualifiedCount: number;
  notQualifiedCount: number;
  needMoreInfoCount: number;
  activeTab: 'qualified' | 'needMoreInfo' | 'notQualified';
  onTabChange: (tab: 'qualified' | 'needMoreInfo' | 'notQualified') => void;
}

export default function MatchesTabs({
  qualifiedCount,
  notQualifiedCount,
  needMoreInfoCount,
  activeTab,
  onTabChange,
}: MatchesTabsProps) {
  const tabs = [
    { id: 'qualified', label: `Qualified`, count: qualifiedCount, color: 'brand', description: 'You meet the hard criteria' },
    { id: 'needMoreInfo', label: `Need More Info`, count: needMoreInfoCount, color: 'amber', description: 'Missing details' },
    { id: 'notQualified', label: `Not Qualified`, count: notQualifiedCount, color: 'slate', description: 'Below minimum requirements' },
  ];

  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
  
  return (
    <div className="relative border-b border-slate-200">
      <div className="flex gap-1 bg-slate-50 rounded-2xl p-1">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => onTabChange(tab.id as 'qualified' | 'needMoreInfo' | 'notQualified')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`relative flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === tab.id 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.id 
                  ? tab.color === 'brand' ? 'bg-brand-100 text-brand-700' :
                    tab.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-200 text-slate-700'
                  : 'bg-slate-200 text-slate-500'
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