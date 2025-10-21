'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, Menu, X, RotateCcw } from 'lucide-react';

interface NavbarProps {
  className?: string;
  onReset?: () => void;
}

export default function Navbar({ className = '', onReset }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Features', href: '#features' },
    { label: 'Benefits', href: '#benefits' },
    { label: 'Contact', href: '#contact' },
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full max-w-[1200px] mx-auto px-4 py-3 ${className}`}
    >
      <div 
        className="bg-white rounded-xl overflow-hidden relative"
        style={{
          borderWidth: '1px',
          borderColor: 'rgb(244, 244, 250)',
          borderStyle: 'solid',
          maxWidth: '100%',
          width: '100%',
          borderRadius: '12px',
          boxShadow: 'none',
        }}
      >
        <div 
          className="flex items-center justify-between w-full min-h-min p-3 relative overflow-hidden"
          style={{
            flexFlow: 'row',
            alignItems: 'center',
            gap: '10px',
            width: '1200px',
            height: 'min-content',
            padding: '12px',
            display: 'flex',
            position: 'relative',
            overflow: 'hidden',
            maxWidth: '100%'
          }}
        >
          {}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Image 
                src="/logos/Frank_logo.png"
                alt="Frank Logo"
                width={96}
                height={25}
                className="h-6 w-auto object-contain"
                priority
              />
            </Link>
          </div>

          {}
          <div className="hidden md:flex items-center space-x-8 absolute left-1/2 transform -translate-x-1/2">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group relative px-3 py-2 transition-colors duration-200"
                style={{
                  fontFamily: '"Satoshi", "Satoshi Placeholder", sans-serif',
                  fontSize: '16px',
                  fontWeight: 300,
                  lineHeight: '1.4em',
                  letterSpacing: '0em',
                  color: '#1a1d21',
                  textDecoration: 'none',
                  textTransform: 'none'
                }}
              >
                <span className="relative z-10 hover:opacity-80">{item.label}</span>
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-slate-900 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
              </Link>
            ))}
          </div>

          {}
          <div className="hidden md:flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-all duration-200 text-sm"
            >
              <span>Chat to Frank</span>
              <ChevronRight 
                size={16} 
                className="group-hover:translate-x-1 transition-transform duration-200" 
              />
            </motion.button>
            {onReset && (
              <motion.button
                whileHover={{ scale: 1.05, rotate: 90 }}
                whileTap={{ scale: 0.95 }}
                onClick={onReset}
                className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-full transition-all duration-200"
                title="Reset chat"
              >
                <RotateCcw size={18} />
              </motion.button>
            )}
          </div>

          {}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 transition-colors duration-200"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {}
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-slate-200"
          >
            <div className="px-6 py-4 space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2 transition-colors duration-200"
                  style={{
                    fontFamily: '"Satoshi", "Satoshi Placeholder", sans-serif',
                    fontSize: '14px',
                    fontWeight: 100,
                    lineHeight: '1.4em',
                    letterSpacing: '0em',
                    color: '#1a1d21',
                    textDecoration: 'none',
                    textTransform: 'none'
                  }}
                >
                  {item.label}
                </Link>
              ))}
              
              {}
              <motion.button
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-all duration-200 mt-4 text-sm"
              >
                <span>Chat to Frank</span>
                <ChevronRight size={16} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.nav>
  );
}