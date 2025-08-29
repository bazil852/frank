'use client';

import { motion } from 'framer-motion';
import { Product } from '@/lib/catalog';
import { Clock, AlertTriangle, TrendingUp } from 'lucide-react';

interface CloseMatchCardProps {
  product: Product;
  reasons: string[];
  improvements: string[];
  index: number;
}

export default function CloseMatchCard({ product, reasons, improvements, index }: CloseMatchCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 300 }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl p-6 shadow-sm border border-amber-200 dark:border-amber-800/50 hover:shadow-lg hover:border-amber-300 dark:hover:border-amber-700 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-sm group-hover:scale-110 transition-transform duration-200">
            {product.provider.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">{product.provider}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1 transition-colors">
              {product.productType} • R{(product.amountMin / 1000).toFixed(0)}k-R{(product.amountMax / 1000).toFixed(0)}k
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 rounded-full transition-colors">
          <Clock size={14} className="text-amber-600" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400 transition-colors">{product.speedDays[0]}-{product.speedDays[1]} days</span>
        </div>
      </div>

      {reasons.length > 0 && (
        <div className="mb-5">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-3 transition-colors">Current gaps:</p>
          <div className="space-y-2">
            {reasons.map((reason, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: (index * 0.05) + (i * 0.1) }}
                className="flex items-start gap-3"
              >
                <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                  <AlertTriangle size={12} className="text-red-600" />
                </div>
                <span className="text-sm text-red-700 leading-relaxed">{reason}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-amber-100/50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800/50 transition-colors">
        <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2 transition-colors">
          <TrendingUp size={16} className="text-amber-600" />
          To qualify:
        </h4>
        <div className="space-y-2">
          {improvements.map((improvement, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: (index * 0.05) + (reasons.length * 0.1) + (i * 0.1) }}
              className="flex items-start gap-3"
            >
              <div className="w-5 h-5 bg-brand-100 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                <TrendingUp size={12} className="text-brand-600" />
              </div>
              <span className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed transition-colors">{improvement}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}