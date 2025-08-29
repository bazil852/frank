'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Profile } from '@/lib/filters';
import { Product } from '@/lib/catalog';
import { DatabaseTracker } from '@/lib/db-tracking';

interface ApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  profile: Profile;
}

export default function ApplyModal({ isOpen, onClose, product, profile }: ApplyModalProps) {
  const [contact, setContact] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState('');

  const handleSubmit = async () => {
    if (!product) return;
    
    setSubmitting(true);
    
    const payload = {
      provider: product.provider,
      product: product.productType,
      businessName: 'Demo Business Ltd',
      contact,
      profile,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: product.id, payload }),
      });
      
      const data = await response.json();
      setApplicationId(data.id);
      
      // Track application in database
      await DatabaseTracker.trackApplication({
        lenderId: product.id,
        profileData: profile,
        contactInfo: contact,
      });
      
      setSubmitted(true);
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const copyPayload = () => {
    const payload = {
      provider: product?.provider,
      product: product?.productType,
      businessName: 'Demo Business Ltd',
      contact,
      profile,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };

  if (!product) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  Send application to {product.provider}
                </h2>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {!submitted ? (
                <>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Business Name
                      </label>
                      <input
                        type="text"
                        value="Demo Business Ltd"
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Name
                      </label>
                      <input
                        type="text"
                        value={contact.name}
                        onChange={(e) => setContact({ ...contact, name: e.target.value })}
                        placeholder="John Smith"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => setContact({ ...contact, email: e.target.value })}
                        placeholder="john@business.co.za"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={contact.phone}
                        onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                        placeholder="082 123 4567"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-600">
                        Amount: <span className="font-medium">R{((profile.amountRequested || 0) / 1000).toFixed(0)}k</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Use of Funds: <span className="font-medium">{profile.useOfFunds || 'Working Capital'}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !contact.name || !contact.email}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Sending...' : 'Submit Application'}
                  </button>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
                  >
                    <Check size={32} className="text-green-600" />
                  </motion.div>
                  <h3 className="text-lg font-semibold mb-2">Application Sent!</h3>
                  <p className="text-gray-600 mb-1">
                    We've sent your details to {product.provider}.
                  </p>
                  <p className="text-gray-600 mb-4">
                    Expect a response in 24-48h.
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    Application ID: {applicationId}
                  </p>
                  <button
                    onClick={copyPayload}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Copy size={16} />
                    Copy summary
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}