'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PersonalityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPersonality: string;
  onSave: (personality: string) => void;
}

const PERSONALITY_PRESETS = [
  { 
    label: 'Professional', 
    value: 'Professional and formal. Use business terminology, be concise and direct. Maintain a serious tone.' 
  },
  { 
    label: 'Friendly', 
    value: 'Warm and approachable. Use casual language, be encouraging and supportive. Show enthusiasm.' 
  },
  { 
    label: 'Expert Advisor', 
    value: 'Knowledgeable financial expert. Provide detailed explanations, use industry insights, be educational.' 
  },
  { 
    label: 'Conversational', 
    value: 'Casual and relaxed. Talk like a friend, use simple language, be relatable and down-to-earth.' 
  },
];

export default function PersonalityModal({ isOpen, onClose, currentPersonality, onSave }: PersonalityModalProps) {
  const [personality, setPersonality] = useState(currentPersonality);
  const [selectedPreset, setSelectedPreset] = useState('');

  useEffect(() => {
    setPersonality(currentPersonality);
  }, [currentPersonality]);

  const handleSave = () => {
    onSave(personality);
    onClose();
  };

  const handlePresetSelect = (preset: string) => {
    setPersonality(preset);
    setSelectedPreset(preset);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div
              className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Customize Frank's Personality</h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Define how Frank should communicate with users. Be specific about tone, style, and approach.
                </p>
              </div>

              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Quick Presets
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {PERSONALITY_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => handlePresetSelect(preset.value)}
                        className={`p-3 text-left rounded-lg border-2 transition-all ${
                          selectedPreset === preset.value
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <p className="font-medium text-gray-900">{preset.label}</p>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{preset.value}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="personality" className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Personality Instructions
                  </label>
                  <textarea
                    id="personality"
                    value={personality}
                    onChange={(e) => setPersonality(e.target.value)}
                    placeholder="E.g., Be friendly and conversational, use South African slang occasionally, be encouraging about their business journey, use emojis sparingly..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none h-32"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Tip: Be specific about tone, language style, formality level, and any unique characteristics.
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> Frank will maintain this personality while still providing accurate funding information and following all safety guidelines.
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!personality.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save size={18} />
                  Save Personality
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}