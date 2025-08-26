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
      whileHover={{ y: -2, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center">
            <span className="text-lg font-bold text-gray-400">
              {product.provider.charAt(0)}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{product.provider}</h3>
            <p className="text-sm text-gray-500">
              {product.productType} • R{(product.amountMin / 1000).toFixed(0)}k-R
              {(product.amountMax / 1000).toFixed(0)}k
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Clock size={14} />
          <span>{product.speedDays[0]}-{product.speedDays[1]} days</span>
        </div>
      </div>

      <ul className="space-y-2 mb-4">
        {reasons.map((reason, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
            <Check size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
            <span>{reason}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onApply}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        Apply
      </button>
    </motion.div>
  );
}