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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -2, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
      className="bg-yellow-50 rounded-2xl p-6 shadow-sm border border-yellow-200 transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <span className="text-lg font-bold text-yellow-600">
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

      {reasons.length > 0 && (
        <div className="mb-3">
          {reasons.map((reason, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-red-700 mb-1">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{reason}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-yellow-800">To qualify:</h4>
        {improvements.map((improvement, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-yellow-700">
            <TrendingUp size={16} className="mt-0.5 flex-shrink-0" />
            <span>{improvement}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}