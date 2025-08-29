'use client';

import { motion } from 'framer-motion';
import { Product } from '@/lib/catalog';
import { Clock, Check } from 'lucide-react';
import Image from 'next/image';

interface MatchCardProps {
  product: Product;
  reasons: string[];
  onApply: () => void;
  index: number;
}

export default function MatchCard({ product, reasons, onApply, index }: MatchCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg hover:border-brand-200 dark:hover:border-brand-700 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-sm group-hover:scale-110 transition-transform duration-200">
            {product.provider.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">{product.provider}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1 transition-colors">
              {product.productType} • R{(product.amountMin / 1000).toFixed(0)}k-R{(product.amountMax / 1000).toFixed(0)}k
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-full transition-colors">
          <Clock size={14} className="text-slate-400 dark:text-slate-500" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400 transition-colors">{product.speedDays[0]}-{product.speedDays[1]} days</span>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {reasons.map((reason, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: (index * 0.05) + (i * 0.1) }}
            className="flex items-start gap-3"
          >
            <div className="w-5 h-5 bg-brand-100 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
              <Check size={12} className="text-brand-600" />
            </div>
            <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed transition-colors">{reason}</span>
          </motion.div>
        ))}
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onApply}
        className="w-full bg-brand-600 text-white py-3 px-6 rounded-2xl font-semibold shadow-sm hover:shadow-md hover:bg-brand-700 transition-all duration-200 text-sm"
      >
        Apply Now
      </motion.button>
    </motion.div>
  );
}