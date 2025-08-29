'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Profile } from '@/lib/filters';
import { X } from 'lucide-react';

interface ChipsBarProps {
  profile: Profile;
}

export default function ChipsBar({ profile }: ChipsBarProps) {
  const chips: string[] = [];

  if (profile.industry) chips.push(profile.industry);
  if (profile.yearsTrading) chips.push(`${profile.yearsTrading}y`);
  if (profile.monthlyTurnover) {
    chips.push(`R${(profile.monthlyTurnover / 1000).toFixed(0)}k/mo`);
  }
  if (profile.vatRegistered) chips.push('VAT ✓');
  if (profile.amountRequested) {
    chips.push(`Need R${(profile.amountRequested / 1000).toFixed(0)}k`);
  }
  if (profile.urgencyDays) chips.push(`in ${profile.urgencyDays} days`);

  return (
    <div className="flex flex-wrap gap-3">
      <AnimatePresence mode="popLayout">
        {chips.map((chip, index) => (
          <motion.span
            key={chip}
            layout
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.05 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-400 text-sm font-semibold rounded-2xl border border-brand-200 dark:border-brand-800/50 shadow-sm transition-colors duration-200"
          >
            <span className="w-2 h-2 bg-brand-600 rounded-full"></span>
            {chip}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}