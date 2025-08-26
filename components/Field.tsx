'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface FieldProps {
  label: string;
  type: 'text' | 'number' | 'select' | 'toggle';
  value: any;
  onChange: (value: any) => void;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  error?: string;
  description?: string;
  prefix?: string;
}

export default function Field({
  label,
  type,
  value,
  onChange,
  options,
  placeholder,
  error,
  description,
  prefix,
}: FieldProps) {
  const [focused, setFocused] = useState(false);

  const formatNumber = (val: string) => {
    if (!val) return '';
    const num = parseInt(val.replace(/\D/g, ''));
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('en-ZA').format(num);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    onChange(raw ? parseInt(raw) : undefined);
  };

  return (
    <div className="space-y-1">
      <motion.label
        animate={{ color: focused ? '#2563eb' : '#374151' }}
        className="block text-sm font-medium"
      >
        {label}
      </motion.label>
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            {prefix}
          </span>
        )}
        {type === 'select' ? (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Select {label}</option>
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : type === 'toggle' ? (
          <button
            type="button"
            onClick={() => onChange(!value)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              value ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <motion.span
              className="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm"
              animate={{ x: value ? 24 : 2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          </button>
        ) : type === 'number' ? (
          <input
            type="text"
            value={value ? formatNumber(String(value)) : ''}
            onChange={handleNumberChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all ${
              prefix ? 'pl-12' : ''
            } ${error ? 'border-red-500' : 'border-gray-300'}`}
          />
        ) : (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-xs text-red-500"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}