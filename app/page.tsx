'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Maximize2, Minimize2, MessageSquare, X } from 'lucide-react';
import ModeToggle from '@/components/ModeToggle';
import Field from '@/components/Field';
import ChipsBar from '@/components/ChipsBar';
import MatchesTabs from '@/components/MatchesTabs';
import MatchCard from '@/components/MatchCard';
import FilteredCard from '@/components/FilteredCard';
import CloseMatchCard from '@/components/CloseMatchCard';
import ApplyModal from '@/components/ApplyModal';
import ChatUI from '@/components/ChatUI';
import ThemeToggle from '@/components/ThemeToggle';
import { Profile, filterProducts } from '@/lib/filters';
import { Product } from '@/lib/catalog';
import { getLendersFromDB } from '@/lib/db-lenders';
import { useUserTracking } from '@/hooks/useUserTracking';
import { ConversationTracker } from '@/lib/db-conversations';
import { FrankAI } from '@/lib/openai-client';

export default function Home() {
  const { userId, sessionId, trackEvent, trackApplication } = useUserTracking();
  const [mode, setMode] = useState<'form' | 'chat'>('chat');
  const [hasUserInput, setHasUserInput] = useState(false);
  const [hasFirstResponse, setHasFirstResponse] = useState(false);
  const [profile, setProfile] = useState<Profile>({});
  const [activeTab, setActiveTab] = useState<'qualified' | 'notQualified' | 'needMoreInfo'>('qualified');
  const [filtering, setFiltering] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [matches, setMatches] = useState<{ 
    qualified: Product[]; 
    notQualified: Array<{ product: Product; reasons: string[] }>; 
    needMoreInfo: Array<{ product: Product; reasons: string[]; improvements: string[] }>;
  }>({
    qualified: [],
    notQualified: [],
    needMoreInfo: [],
  });
  const [matchReasons, setMatchReasons] = useState<Record<string, string[]>>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState<'none' | 'chat' | 'matches'>('none');
  const [showMobileModal, setShowMobileModal] = useState(false);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    console.log('updateProfile called with:', updates);
    
    const updatedProfile = { ...profile, ...updates };
    
    // Update local state
    setProfile(updatedProfile);
    setFiltering(true);
    
    // Save profile updates to database for personalization
    try {
      await ConversationTracker.updateUserBusinessProfile(updates);
      console.log('Profile saved to database:', updates);
    } catch (error) {
      console.error('Error saving profile to database:', error);
    }
    
    // Track profile update event
    trackEvent('profile_updated', {
      updates,
      mode,
      userId,
      sessionId
    });
    
    // Check if we have enough information to show the matches panel
    const keyFields = [
      updatedProfile.industry, 
      updatedProfile.yearsTrading, 
      updatedProfile.monthlyTurnover, 
      updatedProfile.amountRequested
    ];
    const filledFields = keyFields.filter(field => field !== undefined && field !== null && field !== '').length;
    
    console.log(`updateProfile: ${filledFields}/4 fields filled`);
    
    // Show panel if we have 3 or 4 key fields
    if (filledFields >= 3) {
      setHasUserInput(true);
      trackEvent('matches_panel_opened', { filledFields });
    }
  }, [profile, trackEvent, mode, userId, sessionId]);

  const fetchProductReasons = useCallback(async (product: Product, profile: Profile) => {
    try {
      const rationale = await FrankAI.getProductRationale(product, profile);
      return rationale;
    } catch {
      return 'Well-suited for your business needs';
    }
  }, []);

  // Fetch products from database on component mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoadingProducts(true);
        const dbProducts = await getLendersFromDB();
        console.log('Fetched products from database:', dbProducts);
        setProducts(dbProducts);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, []);

  // Load user's saved business profile on component mount
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        if (!userId) return;
        
        const savedProfile = await ConversationTracker.getUserBusinessProfile();
        if (savedProfile && Object.keys(savedProfile).length > 0) {
          console.log('Loading saved user profile:', savedProfile);
          setProfile(prevProfile => ({
            ...prevProfile,
            ...savedProfile
          }));
          
          // Check if we should show matches based on saved profile
          const keyFields = [
            savedProfile.industry, 
            savedProfile.yearsTrading, 
            savedProfile.monthlyTurnover, 
            savedProfile.amountRequested
          ];
          const filledFields = keyFields.filter(field => field !== undefined && field !== null && field !== '').length;
          
          if (filledFields >= 3) {
            setHasUserInput(true);
            // Also unblur the panel since user clearly had a previous conversation
            setHasFirstResponse(true);
          }
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };

    loadUserProfile();
  }, [userId]);

  // Monitor hasFirstResponse state changes for debugging
  useEffect(() => {
    console.log('🎭 hasFirstResponse state changed to:', hasFirstResponse);
    console.log('🎭 Panel should be:', hasFirstResponse ? 'UNBLURRED' : 'BLURRED');
  }, [hasFirstResponse]);

  useEffect(() => {
    if (loadingProducts || products.length === 0) return;
    
    console.log('useEffect for filtering triggered with profile:', profile);
    const timer = setTimeout(async () => {
      console.log('Running filterProducts with profile:', profile);
      const result = filterProducts(profile, products);
      console.log('Filter results:', result);
      setMatches(result);
      
      // Only fetch GPT reasons if we have meaningful profile data
      const hasProfileData = profile.industry || profile.yearsTrading || profile.monthlyTurnover || profile.amountRequested;
      
      const newReasons: Record<string, string[]> = {};
      
      for (const product of result.qualified) {
        const deterministic: string[] = [];
        
        if (profile.yearsTrading && profile.yearsTrading >= product.minYears) {
          deterministic.push(`You meet ${product.minYears}y+ trading requirement`);
        }
        
        if (profile.amountRequested) {
          if (profile.amountRequested >= product.amountMin && profile.amountRequested <= product.amountMax) {
            deterministic.push('Request within lender range');
          }
        }
        
        // Temporarily disable GPT rationale calls to prevent excessive API usage
        let gptReason = 'Good fit for your business needs';
        // if (hasProfileData) {
        //   gptReason = await fetchProductReasons(product, profile);
        // }
        
        newReasons[product.id] = [
          ...deterministic.slice(0, 2),
          gptReason
        ].slice(0, 3);
      }
      
      setMatchReasons(newReasons);
      setFiltering(false);
      console.log('Filtering completed, matches updated');
    }, 250);

    return () => clearTimeout(timer);
  }, [profile, fetchProductReasons, products, loadingProducts]);

  const handleChatMessage = async (message: string, chatHistory?: Array<{role: 'system' | 'user' | 'assistant', content: string}>, personality?: string): Promise<string> => {
    try {
      console.log('💬 Starting handleChatMessage with:', { message, hasFirstResponse, hasUserInput });
      setIsProcessing(true);
      
      // Get current match results for AI context
      const currentMatches = filterProducts(profile, products);
      
      // Use frontend OpenAI client
      const data = await FrankAI.chat(message, chatHistory || [], profile, products, currentMatches);
      console.log('Frank AI response:', data);
      
      if (data.extracted && Object.keys(data.extracted).length > 0) {
        console.log('Extracted data from API:', data.extracted);
        
        // Use updateProfile to ensure filtering is triggered
        updateProfile(data.extracted);
        
        // Get the updated profile for checking
        const updatedProfile = { ...profile, ...data.extracted };
        console.log('Updated profile:', updatedProfile);
        console.log('Has all required fields:', {
          industry: updatedProfile.industry,
          yearsTrading: updatedProfile.yearsTrading,
          monthlyTurnover: updatedProfile.monthlyTurnover,
          amountRequested: updatedProfile.amountRequested
        });
        
        // Check if we now have enough information after this update
        const keyFields = [
          updatedProfile.industry, 
          updatedProfile.yearsTrading, 
          updatedProfile.monthlyTurnover, 
          updatedProfile.amountRequested
        ];
        const filledFields = keyFields.filter(field => field !== undefined && field !== null && field !== '').length;
        
        console.log(`Have ${filledFields}/4 key fields:`, {
          industry: updatedProfile.industry,
          yearsTrading: updatedProfile.yearsTrading,
          monthlyTurnover: updatedProfile.monthlyTurnover,
          amountRequested: updatedProfile.amountRequested
        });
        
        // First, check if we should unblur the panel (before any early returns)
        if (!hasFirstResponse && data.extracted && Object.keys(data.extracted).length > 0) {
          console.log('🔍 UNBLUR CHECK - Current state:', {
            hasFirstResponse,
            hasUserInput,
            isProcessing
          });
          
          console.log('🔍 UNBLUR CHECK - Response data:', {
            hasExtracted: !!data.extracted,
            extractedKeys: data.extracted ? Object.keys(data.extracted) : [],
            extractedCount: data.extracted ? Object.keys(data.extracted).length : 0,
            extractedData: data.extracted
          });
          
          console.log('✅ UNBLURRING: All conditions met!');
          console.log('✅ Setting hasFirstResponse from false to true');
          setHasFirstResponse(true);
        }

        if (filledFields >= 3) {
          console.log('Have enough fields (3+)! Setting hasUserInput to true');
          
          // Check if this is the first time we have enough info
          const previousFields = [profile.industry, profile.yearsTrading, profile.monthlyTurnover, profile.amountRequested];
          const previousFilledCount = previousFields.filter(field => field !== undefined && field !== null && field !== '').length;
          
          if (!hasUserInput || previousFilledCount < 3) {
            // Add a slight delay for smooth animation
            setTimeout(() => {
              setHasUserInput(true);
            }, 100);
            
            // Use the OpenAI response since it's more detailed and relevant
            setIsProcessing(false);
            const finalResponse = data.summary || 'Got it — I\'ll tune your matches based on your needs';
            console.log('💬 Completed handleChatMessage with early return. Final state:', { hasFirstResponse, hasUserInput, finalResponse });
            return finalResponse;
          }
        } else {
          console.log(`Still need more fields (have ${filledFields}/4, need 3+)`);
        }
      }
      
      setIsProcessing(false);
      
      const finalResponse = data.summary || 'Got it — I\'ll tune your matches based on your needs';
      console.log('💬 Completed handleChatMessage. Final state:', { hasFirstResponse, hasUserInput, finalResponse });
      return finalResponse;
    } catch (error) {
      console.error('❌ Error calling GPT API:', error);
      setIsProcessing(false);
      return 'Got it — I\'ll tune your matches based on your needs';
    }
  };

  const handleChatReset = useCallback(async () => {
    // Reset all local state
    setProfile({});
    setHasUserInput(false);
    setHasFirstResponse(false);
    setMatches({
      qualified: [],
      notQualified: [],
      needMoreInfo: [],
    });
    setMatchReasons({});
    setFiltering(false);
    setIsProcessing(false);
    
    // Reset user's business profile while preserving anonymous identity
    try {
      await ConversationTracker.resetUserBusinessProfile();
      console.log('Business profile reset while preserving user identity');
    } catch (error) {
      console.error('Error resetting business profile:', error);
    }
  }, []);

  const handleApply = (product: Product) => {
    setSelectedProduct(product);
    setShowApplyModal(true);
  };

  const toggleChatExpansion = () => {
    setExpandedPanel(prev => prev === 'chat' ? 'none' : 'chat');
  };

  const toggleMatchesExpansion = () => {
    setExpandedPanel(prev => prev === 'matches' ? 'none' : 'matches');
  };

  const toggleMobileModal = () => {
    setShowMobileModal(prev => !prev);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <header className="bg-white/90 dark:bg-slate-900/90 border-b border-slate-100 dark:border-slate-800 shadow-sm backdrop-blur-sm sticky top-0 z-50 transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="cursor-pointer"
            >
              <Image 
                src="/logos/Frank_logo.png"
                alt="Frank Logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight transition-colors duration-200"
            >
              rank
            </motion.h1>
          </motion.div>
          <div className="flex items-center gap-4">
            <motion.span 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-2xl font-medium shadow-sm"
            >
              <div className="w-2 h-2 bg-brand-600 rounded-full animate-pulse"></div>
              Beta • Demo
            </motion.span>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
            >
              <ThemeToggle />
            </motion.div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <motion.div 
          layout
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className={`grid grid-cols-1 gap-8 ${
          mode === 'chat' 
            ? expandedPanel === 'chat' 
              ? 'md:grid-cols-1' 
              : expandedPanel === 'matches'
                ? 'md:grid-cols-1'
                : 'md:grid-cols-5'
            : ''
        }`}>
          <motion.div 
            layout
            animate={{
              opacity: expandedPanel === 'matches' ? 0 : 1,
              scale: expandedPanel === 'matches' ? 0.95 : 1
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className={`space-y-6 ${
            mode === 'chat' 
              ? expandedPanel === 'matches' 
                ? 'hidden md:hidden' 
                : expandedPanel === 'chat'
                  ? 'md:col-span-1 md:max-w-none'
                  : 'md:col-span-3'
              : 'col-span-1 md:col-span-5 md:max-w-4xl md:mx-auto'
          }`}>
            {mode === 'form' && (
              <ModeToggle mode={mode} onModeChange={setMode} />
            )}


            {mode === 'form' ? (
              <motion.div 
                layout
                transition={{ duration: 0.3 }}
                className="w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 sticky top-8 h-[calc(100vh-8rem)] flex flex-col transition-colors duration-200"
              >
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
              </motion.div>
            ) : (
              <motion.div
                layout
                transition={{ duration: 0.3 }}
                className="w-full sticky top-8 h-[calc(100vh-8rem)]"
              >
                <ChatUI 
                  onMessage={handleChatMessage} 
                  onReset={handleChatReset}
                  onToggleExpand={toggleChatExpansion}
                  isExpanded={expandedPanel === 'chat'}
                  showProfileProgress={!hasUserInput}
                  profile={profile}
                  showChips={hasUserInput}
                  hideMobileFeatures={true}
                  onProfileUpdate={updateProfile}
                />
              </motion.div>
            )}


            <AnimatePresence>
              {filtering && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 transition-colors duration-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 transition-colors duration-200">Analyzing your profile</p>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <motion.div
                          className="h-full bg-brand-600 rounded-full"
                          initial={{ width: '0%' }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 0.8, ease: "easeInOut" }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <AnimatePresence>
            {mode === 'chat' && (
              <motion.div
                layout
                initial={{ opacity: 0, x: 100 }}
                animate={{ 
                  opacity: expandedPanel === 'chat' ? 0 : 1, 
                  x: 0,
                  scale: expandedPanel === 'chat' ? 0.95 : 1,
                  filter: hasFirstResponse ? 'blur(0px)' : 'blur(8px)'
                }}
                exit={{ opacity: 0, x: 100, scale: 0.95 }}
                transition={{ 
                  duration: 0.5, 
                  ease: "easeInOut",
                  layout: { duration: 0.6, ease: "easeInOut" }
                }}
                className={`hidden md:block ${
                  expandedPanel === 'chat' 
                    ? 'md:hidden' 
                    : expandedPanel === 'matches'
                      ? 'md:col-span-1 md:sticky md:top-8 md:h-[calc(100vh-8rem)]'
                      : 'md:col-span-2 md:sticky md:top-8 md:h-[calc(100vh-8rem)]'
                }`}
              >
                <motion.div 
                  layout
                  transition={{ duration: 0.3 }}
                  className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 h-full flex flex-col transition-colors duration-200 relative"
                >
                  <AnimatePresence>
                    {!hasFirstResponse && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-50/80 dark:bg-slate-800/80 rounded-2xl flex items-center justify-center backdrop-blur-sm z-10"
                      >
                        <div className="text-center space-y-2">
                          <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900 rounded-2xl flex items-center justify-center mx-auto">
                            <span className="text-2xl">💬</span>
                          </div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Start chatting to see your matches</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Tell Frank about your business needs</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-brand-600 rounded-lg flex items-center justify-center">
                          <span className="text-white text-sm font-bold">⚡</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 transition-colors duration-200">Your Matches</h2>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05, rotate: 5 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleMatchesExpansion}
                        className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full transition-all duration-300 ease-in-out"
                        title={expandedPanel === 'matches' ? "Minimize matches" : "Expand matches"}
                      >
                        <motion.div
                          animate={{ rotate: expandedPanel === 'matches' ? 180 : 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                        >
                          {expandedPanel === 'matches' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </motion.div>
                      </motion.button>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 transition-colors duration-200">Live results personalized to your business</p>
                  </div>
                  <MatchesTabs
                    qualifiedCount={matches.qualified.length}
                    notQualifiedCount={matches.notQualified.length}
                    needMoreInfoCount={matches.needMoreInfo.length}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />

                  <div className="flex-1 overflow-y-auto mt-6">
                    <AnimatePresence mode="wait">
                      {isProcessing && matches.qualified.length === 0 ? (
                        <motion.div
                          key="processing"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center justify-center h-full text-center"
                        >
                          <div className="space-y-4">
                            <div className="flex justify-center">
                              <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <div>
                              <p className="text-lg font-semibold text-slate-900">Analyzing your requirements...</p>
                              <p className="text-sm text-slate-600 mt-2">Finding the best funding matches for you</p>
                            </div>
                          </div>
                        </motion.div>
                      ) : activeTab === 'qualified' ? (
                        <motion.div
                          key="qualified"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-4"
                        >
                          {matches.qualified.length > 0 ? (
                            matches.qualified.map((product, index) => (
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
                            <div className="text-center py-12">
                              {isProcessing ? (
                                <div className="space-y-3">
                                  <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                  <p className="text-slate-600 font-medium">Processing your information...</p>
                                </div>
                              ) : profile.amountRequested || profile.monthlyTurnover ? (
                                <div className="space-y-3">
                                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
                                    <span className="text-2xl">🔍</span>
                                  </div>
                                  <div>
                                    <p className="text-slate-700 font-medium">No perfect matches yet</p>
                                    <p className="text-sm text-slate-500 mt-1">Try adjusting your amount or timeline</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto">
                                    <span className="text-2xl">💬</span>
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-900">Tell me about your business</p>
                                    <p className="text-sm text-slate-600 mt-1">I'll find the best funding matches as you share details</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      ) : activeTab === 'needMoreInfo' ? (
                        <motion.div
                          key="close"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-4"
                        >
                          {matches.needMoreInfo.length > 0 ? (
                            matches.needMoreInfo.map((item, index) => (
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
                          key="notQualified"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-4"
                        >
                          {matches.notQualified.length > 0 ? (
                            matches.notQualified.map((item, index) => (
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
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {mode === 'form' && (
            <div className="md:col-span-3 md:sticky md:top-8 md:h-[calc(100vh-8rem)]">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 h-full flex flex-col transition-colors duration-200">
                <MatchesTabs
                  qualifiedCount={matches.qualified.length}
                  notQualifiedCount={matches.notQualified.length}
                  needMoreInfoCount={matches.needMoreInfo.length}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />

                <div className="flex-1 overflow-y-auto mt-6">
                  <AnimatePresence mode="wait">
                    {activeTab === 'qualified' ? (
                      <motion.div
                        key="qualified"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                      >
                        {matches.qualified.length > 0 ? (
                          matches.qualified.map((product, index) => (
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
                    ) : activeTab === 'needMoreInfo' ? (
                      <motion.div
                        key="close"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                      >
                        {matches.needMoreInfo.length > 0 ? (
                          matches.needMoreInfo.map((item, index) => (
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
                        key="notQualified"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                      >
                        {matches.notQualified.length > 0 ? (
                          matches.notQualified.map((item, index) => (
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
        </motion.div>

        {/* Mobile Floating Recommendations Button */}
        {hasUserInput && mode === 'chat' && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleMobileModal}
            className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg flex items-center justify-center z-50 transition-colors duration-200"
            title="View recommendations"
          >
            <MessageSquare size={24} />
            {matches.qualified.length > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
              >
                {matches.qualified.length}
              </motion.div>
            )}
          </motion.button>
        )}
      </main>

      {/* Mobile Recommendations Modal */}
      <AnimatePresence>
        {showMobileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={toggleMobileModal}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full bg-white dark:bg-slate-900 rounded-t-2xl max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-brand-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-bold">⚡</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Recommendations</h2>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleMobileModal}
                  className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full"
                >
                  <X size={20} />
                </motion.button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                  <MatchesTabs
                    qualifiedCount={matches.qualified.length}
                    notQualifiedCount={matches.notQualified.length}
                    needMoreInfoCount={matches.needMoreInfo.length}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />

                  <div className="mt-6">
                    <AnimatePresence mode="wait">
                      {activeTab === 'qualified' ? (
                        <motion.div
                          key="qualified"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-4"
                        >
                          {matches.qualified.length > 0 ? (
                            matches.qualified.map((product, index) => (
                              <MatchCard
                                key={product.id}
                                product={product}
                                reasons={matchReasons[product.id] || [
                                  'Meets basic requirements',
                                  'Good fit for your profile',
                                  'Fast approval process'
                                ]}
                                onApply={() => {
                                  handleApply(product);
                                  setShowMobileModal(false);
                                }}
                                index={index}
                              />
                            ))
                          ) : (
                            <div className="text-center py-12">
                              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <span className="text-2xl">🔍</span>
                              </div>
                              <p className="text-slate-700 dark:text-slate-300 font-medium">No matches yet</p>
                              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Keep sharing details to find matches</p>
                            </div>
                          )}
                        </motion.div>
                      ) : activeTab === 'needMoreInfo' ? (
                        <motion.div
                          key="close"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-4"
                        >
                          {matches.needMoreInfo.length > 0 ? (
                            matches.needMoreInfo.map((item, index) => (
                              <CloseMatchCard
                                key={item.product.id}
                                product={item.product}
                                reasons={item.reasons}
                                improvements={item.improvements}
                                index={index}
                              />
                            ))
                          ) : (
                            <div className="text-center py-12">
                              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <span className="text-2xl">📋</span>
                              </div>
                              <p className="text-slate-700 dark:text-slate-300 font-medium">No close matches</p>
                            </div>
                          )}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="notQualified"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-4"
                        >
                          {matches.notQualified.length > 0 ? (
                            matches.notQualified.map((item, index) => (
                              <FilteredCard
                                key={item.product.id}
                                product={item.product}
                                reasons={item.reasons}
                                index={index}
                              />
                            ))
                          ) : (
                            <div className="text-center py-12">
                              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <span className="text-2xl">✅</span>
                              </div>
                              <p className="text-slate-700 dark:text-slate-300 font-medium">All lenders qualify so far</p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ApplyModal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        product={selectedProduct}
        profile={profile}
      />
    </div>
  );
}