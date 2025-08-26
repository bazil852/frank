'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ModeToggle from '@/components/ModeToggle';
import Field from '@/components/Field';
import ChipsBar from '@/components/ChipsBar';
import MatchesTabs from '@/components/MatchesTabs';
import MatchCard from '@/components/MatchCard';
import FilteredCard from '@/components/FilteredCard';
import CloseMatchCard from '@/components/CloseMatchCard';
import ApplyModal from '@/components/ApplyModal';
import ChatUI from '@/components/ChatUI';
import { Profile, filterProducts } from '@/lib/filters';
import { PRODUCTS, Product } from '@/lib/catalog';

export default function Home() {
  const [mode, setMode] = useState<'form' | 'chat'>('chat');
  const [hasUserInput, setHasUserInput] = useState(false);
  const [profile, setProfile] = useState<Profile>({});
  const [activeTab, setActiveTab] = useState<'available' | 'filtered' | 'close'>('available');
  const [filtering, setFiltering] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [matches, setMatches] = useState<{ 
    available: Product[]; 
    filtered: Array<{ product: Product; reasons: string[] }>; 
    closeMatches: Array<{ product: Product; reasons: string[]; improvements: string[] }>;
  }>({
    available: [],
    filtered: [],
    closeMatches: [],
  });
  const [matchReasons, setMatchReasons] = useState<Record<string, string[]>>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);

  const updateProfile = useCallback((updates: Partial<Profile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
    setFiltering(true);
    
    // Check if we have complete information to show the matches panel
    const updatedProfile = { ...profile, ...updates };
    // Require at least: industry, years trading, monthly turnover, and amount requested
    if (updatedProfile.industry && 
        updatedProfile.yearsTrading && 
        updatedProfile.monthlyTurnover && 
        updatedProfile.amountRequested) {
      setHasUserInput(true);
    }
  }, [profile]);

  const fetchProductReasons = useCallback(async (product: Product, profile: Profile) => {
    try {
      const response = await fetch('/api/gpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          productNotes: product.notes,
        }),
      });
      const data = await response.json();
      return data.rationale || 'Well-suited for your business needs';
    } catch {
      return 'Well-suited for your business needs';
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const result = filterProducts(profile, PRODUCTS);
      setMatches(result);
      
      const newReasons: Record<string, string[]> = {};
      
      for (const product of result.available) {
        const deterministic: string[] = [];
        
        if (profile.yearsTrading && profile.yearsTrading >= product.minYears) {
          deterministic.push(`You meet ${product.minYears}y+ trading requirement`);
        }
        
        if (profile.amountRequested) {
          if (profile.amountRequested >= product.amountMin && profile.amountRequested <= product.amountMax) {
            deterministic.push('Request within lender range');
          }
        }
        
        const gptReason = await fetchProductReasons(product, profile);
        
        newReasons[product.id] = [
          ...deterministic.slice(0, 2),
          gptReason
        ].slice(0, 3);
      }
      
      setMatchReasons(newReasons);
      setFiltering(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [profile, fetchProductReasons]);

  const handleChatMessage = async (message: string, chatHistory?: Array<{role: string, content: string}>, personality?: string): Promise<string> => {
    try {
      console.log('Sending chat message to API:', message);
      setIsProcessing(true);
      
      const response = await fetch('/api/gpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, profile, chatHistory, personality }),
      });
      
      if (!response.ok) {
        console.error('API response not OK:', response.status);
      }
      
      const data = await response.json();
      console.log('API response data:', data);
      
      if (data.extracted && Object.keys(data.extracted).length > 0) {
        // First update the profile
        const updatedProfile = { ...profile, ...data.extracted };
        setProfile(updatedProfile);
        setFiltering(true);
        
        console.log('Updated profile:', updatedProfile);
        console.log('Has all required fields:', {
          industry: updatedProfile.industry,
          yearsTrading: updatedProfile.yearsTrading,
          monthlyTurnover: updatedProfile.monthlyTurnover,
          amountRequested: updatedProfile.amountRequested
        });
        
        // Check if we now have complete information after this update
        if (updatedProfile.industry && 
            updatedProfile.yearsTrading && 
            updatedProfile.monthlyTurnover && 
            updatedProfile.amountRequested) {
          
          console.log('All required fields present! Setting hasUserInput to true');
          
          // Check if this is the first time we have complete info
          const wasIncomplete = !profile.industry || !profile.yearsTrading || 
                               !profile.monthlyTurnover || !profile.amountRequested;
          
          if (!hasUserInput || wasIncomplete) {
            // Add a slight delay for smooth animation
            setTimeout(() => {
              setHasUserInput(true);
            }, 100);
            setIsProcessing(false);
            return 'Perfect! I have all the essential information. Your funding matches are now appearing on the right. Feel free to tell me more to refine your results.';
          }
        } else {
          console.log('Still missing required fields');
        }
      }
      
      setIsProcessing(false);
      return data.summary || 'Got it — I\'ll tune your matches based on your needs';
    } catch (error) {
      console.error('Error calling GPT API:', error);
      setIsProcessing(false);
      return 'Got it — I\'ll tune your matches based on your needs';
    }
  };

  const handleApply = (product: Product) => {
    setSelectedProduct(product);
    setShowApplyModal(true);
  };

  const industries = [
    { value: 'Retail', label: 'Retail' },
    { value: 'Services', label: 'Services' },
    { value: 'Manufacturing', label: 'Manufacturing' },
    { value: 'Hospitality', label: 'Hospitality' },
    { value: 'Logistics', label: 'Logistics' },
    { value: 'Other', label: 'Other' },
  ];

  const useOfFunds = [
    { value: 'Working Capital', label: 'Working Capital' },
    { value: 'Inventory', label: 'Inventory' },
    { value: 'Equipment', label: 'Equipment' },
    { value: 'Marketing', label: 'Marketing' },
    { value: 'Bridging', label: 'Bridging' },
  ];

  const provinces = [
    { value: 'Gauteng', label: 'Gauteng' },
    { value: 'Western Cape', label: 'Western Cape' },
    { value: 'KZN', label: 'KwaZulu-Natal' },
    { value: 'Eastern Cape', label: 'Eastern Cape' },
    { value: 'Free State', label: 'Free State' },
    { value: 'North West', label: 'North West' },
    { value: 'Limpopo', label: 'Limpopo' },
    { value: 'Mpumalanga', label: 'Mpumalanga' },
    { value: 'Northern Cape', label: 'Northern Cape' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-600">Frank</h1>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            MVP • Demo
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className={`grid grid-cols-1 gap-8 transition-all duration-500 ${
          hasUserInput && mode === 'chat' ? 'md:grid-cols-5' : ''
        }`}>
          <div className={`space-y-6 transition-all duration-500 ${
            hasUserInput && mode === 'chat' ? 'md:col-span-3' : 'md:col-span-5 md:max-w-4xl md:mx-auto'
          }`}>
            {mode === 'form' && (
              <ModeToggle mode={mode} onModeChange={setMode} />
            )}

            {mode === 'chat' && !hasUserInput && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">Information Progress</p>
                    <div className="mt-2 space-y-1">
                      <div className="text-xs text-blue-700">
                        <span className={profile.industry ? 'text-green-600 font-medium' : ''}>
                          {profile.industry ? '✓' : '○'} Industry
                        </span>
                      </div>
                      <div className="text-xs text-blue-700">
                        <span className={profile.yearsTrading ? 'text-green-600 font-medium' : ''}>
                          {profile.yearsTrading ? '✓' : '○'} Years Trading
                        </span>
                      </div>
                      <div className="text-xs text-blue-700">
                        <span className={profile.monthlyTurnover ? 'text-green-600 font-medium' : ''}>
                          {profile.monthlyTurnover ? '✓' : '○'} Monthly Turnover
                        </span>
                      </div>
                      <div className="text-xs text-blue-700">
                        <span className={profile.amountRequested ? 'text-green-600 font-medium' : ''}>
                          {profile.amountRequested ? '✓' : '○'} Amount Requested
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {[profile.industry, profile.yearsTrading, profile.monthlyTurnover, profile.amountRequested].filter(Boolean).length}/4
                    </div>
                    <p className="text-xs text-blue-600 mt-1">Required</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm p-6">
              {mode === 'form' ? (
                <div className="space-y-4">
                  <Field
                    label="Industry"
                    type="select"
                    value={profile.industry}
                    onChange={(value) => updateProfile({ industry: value })}
                    options={industries}
                  />
                  
                  <Field
                    label="Years Trading"
                    type="number"
                    value={profile.yearsTrading}
                    onChange={(value) => updateProfile({ yearsTrading: value })}
                    placeholder="3"
                  />
                  
                  <Field
                    label="Monthly Turnover"
                    type="number"
                    value={profile.monthlyTurnover}
                    onChange={(value) => updateProfile({ monthlyTurnover: value })}
                    prefix="R"
                    placeholder="350,000"
                  />
                  
                  <Field
                    label="VAT Registered"
                    type="toggle"
                    value={profile.vatRegistered}
                    onChange={(value) => updateProfile({ vatRegistered: value })}
                  />
                  
                  <Field
                    label="Amount Requested"
                    type="number"
                    value={profile.amountRequested}
                    onChange={(value) => updateProfile({ amountRequested: value })}
                    prefix="R"
                    placeholder="500,000"
                  />
                  
                  <Field
                    label="Use of Funds"
                    type="select"
                    value={profile.useOfFunds}
                    onChange={(value) => updateProfile({ useOfFunds: value })}
                    options={useOfFunds}
                  />
                  
                  <Field
                    label="Urgency (days)"
                    type="number"
                    value={profile.urgencyDays}
                    onChange={(value) => updateProfile({ urgencyDays: value })}
                    placeholder="10"
                  />
                  
                  <Field
                    label="Province"
                    type="select"
                    value={profile.province}
                    onChange={(value) => updateProfile({ province: value })}
                    options={provinces}
                  />
                </div>
              ) : (
                <div className={`transition-all duration-500 ${
                  hasUserInput ? 'h-[500px]' : 'h-[700px]'
                }`}>
                  <ChatUI onMessage={handleChatMessage} />
                </div>
              )}
            </div>

            {((mode === 'form') || (mode === 'chat' && hasUserInput)) && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <ChipsBar profile={profile} />
              </div>
            )}

            <AnimatePresence>
              {filtering && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-white rounded-2xl shadow-sm p-4"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                      <motion.div
                        className="h-full bg-blue-600"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <span className="text-sm text-gray-500">Filtering...</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {hasUserInput && mode === 'chat' && (
              <motion.div
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 100 }}
                transition={{ duration: 0.5, type: 'spring', stiffness: 100 }}
                className="md:col-span-2 md:sticky md:top-8 md:h-[calc(100vh-8rem)]"
              >
                <div className="bg-white rounded-2xl shadow-sm p-6 h-full flex flex-col">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Your Funding Matches</h2>
                    <p className="text-sm text-gray-500">Live results based on your requirements</p>
                  </div>
                  <MatchesTabs
                    availableCount={matches.available.length}
                    filteredCount={matches.filtered.length}
                    closeMatchCount={matches.closeMatches.length}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
              />

              <div className="flex-1 overflow-y-auto mt-6">
                <AnimatePresence mode="wait">
                  {isProcessing && matches.available.length === 0 ? (
                    <motion.div
                      key="processing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center h-full text-center"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-center">
                          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <div>
                          <p className="text-lg font-medium text-gray-900">Analyzing your requirements...</p>
                          <p className="text-sm text-gray-500 mt-2">Finding the best funding matches for you</p>
                        </div>
                      </div>
                    </motion.div>
                  ) : activeTab === 'available' ? (
                    <motion.div
                      key="available"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      {matches.available.length > 0 ? (
                        matches.available.map((product, index) => (
                          <MatchCard
                            key={product.id}
                            product={product}
                            reasons={matchReasons[product.id] || [
                              'Meets basic requirements',
                              'Good fit for your profile',
                              'Fast approval process'
                            ]}
                            onApply={() => handleApply(product)}
                            index={index}
                          />
                        ))
                      ) : (
                        <div className="text-center py-12 text-gray-500">
                          {isProcessing ? (
                            <p>Processing your information...</p>
                          ) : profile.amountRequested || profile.monthlyTurnover ? (
                            <p>No perfect hits yet — try lowering amount or increasing urgency window.</p>
                          ) : (
                            <div className="space-y-2">
                              <p className="font-medium">Tell me about your business</p>
                              <p className="text-sm">I'll find the best funding matches as you share details</p>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ) : activeTab === 'close' ? (
                    <motion.div
                      key="close"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      {matches.closeMatches.length > 0 ? (
                        matches.closeMatches.map((item, index) => (
                          <CloseMatchCard
                            key={item.product.id}
                            product={item.product}
                            reasons={item.reasons}
                            improvements={item.improvements}
                            index={index}
                          />
                        ))
                      ) : (
                        <div className="text-center py-12 text-gray-500">
                          <p>No close matches found.</p>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="filtered"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      {matches.filtered.length > 0 ? (
                        matches.filtered.map((item, index) => (
                          <FilteredCard
                            key={item.product.id}
                            product={item.product}
                            reasons={item.reasons}
                            index={index}
                          />
                        ))
                      ) : (
                        <div className="text-center py-12 text-gray-500">
                          <p>Nothing excluded yet. Nice.</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {mode === 'form' && (
        <div className="md:col-span-3 md:sticky md:top-8 md:h-[calc(100vh-8rem)]">
          <div className="bg-white rounded-2xl shadow-sm p-6 h-full flex flex-col">
            <MatchesTabs
              availableCount={matches.available.length}
              filteredCount={matches.filtered.length}
              closeMatchCount={matches.closeMatches.length}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            <div className="flex-1 overflow-y-auto mt-6">
              <AnimatePresence mode="wait">
                {activeTab === 'available' ? (
                  <motion.div
                    key="available"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    {matches.available.length > 0 ? (
                      matches.available.map((product, index) => (
                        <MatchCard
                          key={product.id}
                          product={product}
                          reasons={matchReasons[product.id] || [
                            'Meets basic requirements',
                            'Good fit for your profile',
                            'Fast approval process'
                          ]}
                          onApply={() => handleApply(product)}
                          index={index}
                        />
                      ))
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <p>No perfect hits yet — try lowering amount or increasing urgency window.</p>
                      </div>
                    )}
                  </motion.div>
                ) : activeTab === 'close' ? (
                  <motion.div
                    key="close"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    {matches.closeMatches.length > 0 ? (
                      matches.closeMatches.map((item, index) => (
                        <CloseMatchCard
                          key={item.product.id}
                          product={item.product}
                          reasons={item.reasons}
                          improvements={item.improvements}
                          index={index}
                        />
                      ))
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <p>No close matches found.</p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="filtered"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    {matches.filtered.length > 0 ? (
                      matches.filtered.map((item, index) => (
                        <FilteredCard
                          key={item.product.id}
                          product={item.product}
                          reasons={item.reasons}
                          index={index}
                        />
                      ))
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <p>Nothing excluded yet. Nice.</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
    </div>
  </main>

      <ApplyModal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        product={selectedProduct}
        profile={profile}
      />
    </div>
  );
}