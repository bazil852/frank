'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, DollarSign, FileText, CheckCircle, ExternalLink } from 'lucide-react';
import { Product } from '@/lib/catalog';
import MatchesTabs from './MatchesTabs';
import MatchCard from './MatchCard';
import FilteredCard from './FilteredCard';
import CloseMatchCard from './CloseMatchCard';

interface LenderPillsProps {
  matches: {
    qualified: Product[];
    notQualified: Array<{ product: Product; reasons: string[] }>;
    needMoreInfo: Array<{ product: Product; reasons: string[]; improvements: string[] }>;
  };
  hasUserInput: boolean;
}

interface FullMatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: {
    qualified: Product[];
    notQualified: Array<{ product: Product; reasons: string[] }>;
    needMoreInfo: Array<{ product: Product; reasons: string[]; improvements: string[] }>;
  };
}

function FullMatchesModal({ isOpen, onClose, matches }: FullMatchesModalProps) {
  const [activeTab, setActiveTab] = useState<'qualified' | 'needMoreInfo' | 'notQualified'>('qualified');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Your Funding Matches</h3>
                <p className="text-sm text-slate-600 mt-1">
                  {matches.qualified.length + matches.needMoreInfo.length + matches.notQualified.length} lenders found
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-4">
              <MatchesTabs
                qualifiedCount={matches.qualified.length}
                notQualifiedCount={matches.notQualified.length}
                needMoreInfoCount={matches.needMoreInfo.length}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeTab === 'qualified' && matches.qualified.map((product, index) => (
                  <MatchCard
                    key={product.id}
                    product={product}
                    reasons={[]} // Qualified products don't need reasons, pass empty array
                    index={index}
                    onApply={() => {
                      console.log('Apply to:', product.id);
                      // Handle apply action
                    }}
                  />
                ))}

                {activeTab === 'needMoreInfo' && matches.needMoreInfo.map((item) => (
                  <FilteredCard
                    key={item.product.id}
                    product={item.product}
                    reasons={item.improvements}
                    type="improvements"
                  />
                ))}

                {activeTab === 'notQualified' && matches.notQualified.map((item, index) => (
                  <CloseMatchCard
                    key={item.product.id}
                    product={item.product}
                    reasons={item.reasons}
                    improvements={[]} // Not qualified items don't have improvements
                    index={index}
                  />
                ))}
              </div>

              {/* Empty state */}
              {((activeTab === 'qualified' && matches.qualified.length === 0) ||
                (activeTab === 'needMoreInfo' && matches.needMoreInfo.length === 0) ||
                (activeTab === 'notQualified' && matches.notQualified.length === 0)) && (
                <div className="text-center py-12">
                  <div className="text-slate-400 mb-2">
                    {activeTab === 'qualified' && <CheckCircle size={48} className="mx-auto mb-4" />}
                    {activeTab === 'needMoreInfo' && <FileText size={48} className="mx-auto mb-4" />}
                    {activeTab === 'notQualified' && <X size={48} className="mx-auto mb-4" />}
                  </div>
                  <p className="text-slate-600">
                    {activeTab === 'qualified' && 'No qualified lenders yet. Provide more information to unlock matches.'}
                    {activeTab === 'needMoreInfo' && 'No lenders need additional information.'}
                    {activeTab === 'notQualified' && 'No disqualified lenders.'}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function LenderPills({ matches, hasUserInput }: LenderPillsProps) {
  const [showModal, setShowModal] = useState(false);

  const qualifiedCount = matches.qualified.length;
  const totalLenders = matches.qualified.length + matches.needMoreInfo.length + matches.notQualified.length;

  // Only show when user has started interacting and there are lenders
  if (!hasUserInput || totalLenders === 0) return null;

  // Create array of all lenders for horizontal scroll
  const allLenders = [
    ...matches.qualified.map(product => ({ product, type: 'qualified' as const })),
    ...matches.needMoreInfo.map(item => ({ product: item.product, type: 'needMoreInfo' as const })),
    ...matches.notQualified.map(item => ({ product: item.product, type: 'notQualified' as const }))
  ];

  const getPillStyle = (type: string) => {
    switch (type) {
      case 'qualified':
        return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200';
      case 'needMoreInfo':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200';
      case 'notQualified':
        return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200 opacity-60';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'qualified':
        return <CheckCircle size={12} />;
      case 'needMoreInfo':
        return <FileText size={12} />;
      case 'notQualified':
        return <X size={12} />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="md:hidden bg-transparent border-b border-slate-200/50">
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-slate-700">
              {qualifiedCount} Qualified Match{qualifiedCount !== 1 ? 'es' : ''}
            </span>
            <button
              onClick={() => setShowModal(true)}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              View All
            </button>
          </div>
        </div>
        
        {/* Horizontal Scrollable Pills */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 px-4 pb-3 min-w-max">
            {allLenders.slice(0, 8).map((lender, index) => (
              <motion.button
                key={`${lender.type}-${lender.product.id}`}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowModal(true)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors flex-shrink-0 ${getPillStyle(lender.type)}`}
              >
                {getIcon(lender.type)}
                {lender.product.provider}
              </motion.button>
            ))}
            
            {/* Show more indicator if there are more than 8 lenders */}
            {allLenders.length > 8 && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm font-medium border border-slate-200 hover:bg-slate-200 transition-colors flex-shrink-0"
              >
                +{allLenders.length - 8} more
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Full Matches Modal */}
      <FullMatchesModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        matches={matches}
      />
    </>
  );
}