'use client';

import { motion } from 'framer-motion';
import { MessageSquare, FileText } from 'lucide-react';

type Mode = 'form' | 'chat';

interface ModeToggleProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

export default function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="relative flex bg-gray-100 rounded-full p-1">
      <motion.div
        className="absolute inset-y-1 bg-white rounded-full shadow-sm"
        initial={false}
        animate={{
          x: mode === 'form' ? 0 : '100%',
          width: '50%',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />
      <button
        onClick={() => onModeChange('form')}
        className={`relative z-10 flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
          mode === 'form' ? 'text-blue-600' : 'text-gray-600'
        }`}
      >
        <FileText size={16} />
        <span className="font-medium">Form</span>
      </button>
      <button
        onClick={() => onModeChange('chat')}
        className={`relative z-10 flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
          mode === 'chat' ? 'text-blue-600' : 'text-gray-600'
        }`}
      >
        <MessageSquare size={16} />
        <span className="font-medium">Chat</span>
      </button>
    </div>
  );
}