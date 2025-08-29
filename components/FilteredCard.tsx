'use client';

import { motion } from 'framer-motion';
import { Product } from '@/lib/catalog';
import { X } from 'lucide-react';

interface FilteredCardProps {
  product: Product;
  reasons: string[];
  index: number;
}

export default function FilteredCard({ product, reasons, index }: FilteredCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 300 }}
      whileHover={{ scale: 1.02, y: -2 }}
      className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200 group opacity-75"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-200 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-slate-500 dark:text-slate-400 text-xl font-bold group-hover:bg-slate-300 dark:group-hover:bg-slate-600 transition-colors duration-200">
            {product.provider.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-slate-700 dark:text-slate-300 text-lg transition-colors">{product.provider}</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">
              {product.productType} • R{(product.amountMin / 1000).toFixed(0)}k-R{(product.amountMax / 1000).toFixed(0)}k
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 transition-colors">Why it doesn't match:</p>
        {reasons.map((reason, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: (index * 0.05) + (i * 0.1) }}
            className="flex items-start gap-3"
          >
            <div className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
              <X size={12} className="text-slate-500" />
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">{reason}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}