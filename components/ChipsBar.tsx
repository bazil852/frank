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
    <div className="flex flex-wrap gap-2">
      <AnimatePresence mode="popLayout">
        {chips.map((chip) => (
          <motion.span
            key={chip}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-full"
          >
            {chip}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}