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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-red-50 rounded-2xl p-6 border border-red-100"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <span className="text-lg font-bold text-red-400">
              {product.provider.charAt(0)}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{product.provider}</h3>
            <p className="text-sm text-gray-500">{product.productType}</p>
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {reasons.map((reason, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-red-700">
            <X size={16} className="mt-0.5 flex-shrink-0" />
            <span>{reason}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}