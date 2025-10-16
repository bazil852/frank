'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Minimize2 } from 'lucide-react';
import ModeToggle from '@/components/ModeToggle';
import Field from '@/components/Field';
import MatchesTabs from '@/components/MatchesTabs';
import MatchCard from '@/components/MatchCard';
import FilteredCard from '@/components/FilteredCard';
import CloseMatchCard from '@/components/CloseMatchCard';
import ApplyModal from '@/components/ApplyModal';
import ChatUI, { ChatUIRef } from '@/components/ChatUI';
import Navbar from '@/components/Navbar';
import LenderPills from '@/components/LenderPills';
import { Profile, filterProducts } from '@/lib/filters';
import { Product } from '@/lib/catalog';
import { getLendersFromDB } from '@/lib/db-lenders';
import { useUserTracking } from '@/hooks/useUserTracking';
import { ConversationTracker } from '@/lib/db-conversations';
import { FrankAI, GPTResponse } from '@/lib/openai-client';
import { hasHardRequirements } from '@/lib/flow';

export default function Home() {
  const { userId, sessionId, trackEvent, trackApplication } = useUserTracking();
  const chatUIRef = useRef<ChatUIRef>(null);
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
  const [showMatchesPanel, setShowMatchesPanel] = useState(false);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    const updatedProfile = { ...profile, ...updates };
    
    // Update local state
    setProfile(updatedProfile);
    setFiltering(true);
    
    // Save profile updates to database for personalization
    try {
      await ConversationTracker.updateUserBusinessProfile(updates);
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
    
    // Show matches panel only when all hard requirements are present
    const hasAllHard = hasHardRequirements(updatedProfile);
    if (hasAllHard) {
      setHasUserInput(true);
      trackEvent('matches_panel_opened', { hasAllHard: true });
    }
  }, [profile, trackEvent, mode, userId, sessionId]);

  const fetchProductReasons = useCallback(async (product: Product, profile: Profile) => {
    try {
      const rationale = await FrankAI.getProductRationale(product, profile);
      return rationale;
    } catch {
      return 'Fast approval with competitive terms';
    }
  }, []);

  // Fetch products from database on component mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoadingProducts(true);
        const dbProducts = await getLendersFromDB();
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
          setProfile(prevProfile => ({
            ...prevProfile,
            ...savedProfile
          }));
          
          // Show matches only when all hard requirements are present
          if (hasHardRequirements(savedProfile)) {
            setHasUserInput(true);
            // Unblur panel since user clearly had a previous conversation and all hard fields
            setHasFirstResponse(true);
            setShowMatchesPanel(true);
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
    // Removed debug logs
  }, [hasFirstResponse]);

  useEffect(() => {
    if (loadingProducts || products.length === 0) return;
    
    const timer = setTimeout(async () => {
      const result = filterProducts(profile, products);
      console.log('🎯 MATCH RESULTS:', {
        qualified: result.qualified.length,
        needMoreInfo: result.needMoreInfo.length,
        notQualified: result.notQualified.length,
        qualifiedNames: result.qualified.map(p => p.provider),
        profile: profile
      });
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
        let gptReason = 'Fast approval with competitive terms';
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
    }, 250);

    return () => clearTimeout(timer);
  }, [profile, fetchProductReasons, products, loadingProducts]);

  const handleChatMessage = async (
    message: string,
    chatHistory?: Array<{role: 'system' | 'user' | 'assistant', content: string}>,
    personality?: string
  ): Promise<string> => {
    try {
      console.log('💬 USER MESSAGE:', message);
      setIsProcessing(true);

      // Use non-streaming API endpoint
      const response = await fetch('/api/chat-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          chatHistory: chatHistory || [],
          userId,
          sessionId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      const fullResponse = data.summary || '';
      const toolCallsMade = data.toolCallsMade || 0;

      console.log('🔧 TOOL CALLS MADE:', toolCallsMade);
      console.log('💬 AI RESPONSE:', fullResponse);

      // Fetch the updated profile from the database (tools updated it)
      const updatedProfile = await ConversationTracker.getUserBusinessProfile() || {};
      console.log('📊 UPDATED PROFILE FROM DB:', updatedProfile);

      let currentMatches = matches;

      // Recalculate matches if profile changed
      if (Object.keys(updatedProfile).length > 0) {
        currentMatches = filterProducts(updatedProfile as Profile, products);
        console.log('🎯 MATCHES AFTER TOOL EXECUTION:', {
          qualified: currentMatches.qualified.length,
          needMoreInfo: currentMatches.needMoreInfo.length,
          notQualified: currentMatches.notQualified.length
        });

        // Update UI state
        setProfile(updatedProfile as Profile);
        setMatches(currentMatches);
      }

      // Log extraction progress
      const finalProfile = updatedProfile as Profile;
      const requiredFields = ['industry', 'yearsTrading', 'monthlyTurnover', 'amountRequested', 'saRegistered', 'saDirector', 'bankStatements', 'province', 'vatRegistered'];
      const optionalFields = ['collateralAcceptable', 'useOfFunds', 'urgencyDays'];

      const extractedRequired = requiredFields.filter(field => finalProfile[field as keyof typeof finalProfile] !== undefined);
      const missingRequired = requiredFields.filter(field => finalProfile[field as keyof typeof finalProfile] === undefined);
      const extractedOptional = optionalFields.filter(field => finalProfile[field as keyof typeof finalProfile] !== undefined);
      const missingOptional = optionalFields.filter(field => finalProfile[field as keyof typeof finalProfile] === undefined);

      console.log('📊 EXTRACTION PROGRESS:', {
        required: `${extractedRequired.length}/${requiredFields.length} - Have: [${extractedRequired.join(', ')}] - Missing: [${missingRequired.join(', ')}]`,
        optional: `${extractedOptional.length}/${optionalFields.length} - Have: [${extractedOptional.join(', ')}] - Missing: [${missingOptional.join(', ')}]`,
        currentProfile: finalProfile
      });

      // Show matches panel if we extracted data
      if (Object.keys(finalProfile).length > 0) {
        if (!hasFirstResponse) {
          setHasFirstResponse(true);
          setShowMatchesPanel(true);
        }

        if (hasHardRequirements(finalProfile)) {
          const previousHadAllHard = hasHardRequirements(profile);

          if (!hasUserInput || !previousHadAllHard) {
            setTimeout(() => {
              setHasUserInput(true);
            }, 100);

            setIsProcessing(false);
            return fullResponse || 'Got it — I\'ll tune your matches based on your needs';
          }
        }
      }
      
      setIsProcessing(false);

      return fullResponse || 'Got it — I\'ll tune your matches based on your needs';
    } catch (error) {
      console.error('❌ CHAT ERROR:', error);
      setIsProcessing(false);
      
      // Show specific error details
      if (error instanceof Error) {
        console.error('❌ ERROR MESSAGE:', error.message);
        console.error('❌ ERROR STACK:', error.stack);
      }
      
      return 'Sorry, I encountered an error processing your message. Please try again.';
    }
  };

  const handleChatReset = useCallback(async () => {
    // Reset all local state
    setProfile({});
    setHasUserInput(false);
    setHasFirstResponse(false);
    setShowMatchesPanel(false);
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
    <div className="h-screen bg-slate-50 relative flex flex-col overflow-hidden">
      {/* Background blur elements - hide when matches panel is shown */}
      {!showMatchesPanel && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ height: '100%', width: '100%', opacity: 1 }}>
        <div 
          className="absolute rounded-full"
          style={{
            backgroundColor: 'rgba(206, 173, 255, 0.6)',
            filter: 'blur(120px)',
            willChange: 'transform',
            opacity: 1,
            transform: 'translateX(42.5475px) translateY(28.8225px) rotate(49.41deg) skewY(1.3725deg)',
            width: '500px',
            height: '500px',
            top: '5%',
            left: '5%'
          }}
        />
        <div 
          className="absolute rounded-full"
          style={{
            backgroundColor: 'rgba(161, 228, 178, 0.3)',
            filter: 'blur(100px)',
            willChange: 'transform',
            opacity: 0.97255,
            transform: 'translateY(-50%) translateX(-120.78px) translateY(2.745px) rotate(48.0375deg)',
            width: '400px',
            height: '400px',
            top: '30%',
            right: '10%'
          }}
        />
        <div 
          className="absolute rounded-full"
          style={{
            backgroundColor: 'rgba(255, 200, 150, 0.3)',
            filter: 'blur(100px)',
            willChange: 'transform',
            opacity: 0.9726,
            transform: 'translateX(-50%) translateX(46.58px) translateY(-52.06px) rotate(47.95deg)',
            width: '350px',
            height: '350px',
            bottom: '20%',
            left: '30%'
          }}
        />
        <div 
          className="absolute rounded-full"
          style={{
            backgroundColor: 'rgba(147, 51, 234, 0.4)',
            filter: 'blur(150px)',
            willChange: 'transform',
            opacity: 0.8,
            transform: 'rotate(-15deg)',
            width: '600px',
            height: '600px',
            top: '50%',
            left: '50%',
            marginLeft: '-300px',
            marginTop: '-300px'
          }}
        />
        </div>
      )}

      {/* Blur overlay to soften the background - hide when matches panel is shown */}
      {!showMatchesPanel && (
        <div className="fixed inset-0 backdrop-blur-md pointer-events-none bg-white/10" />
      )}

      <header className="z-50 py-4 relative flex-shrink-0">
        <Navbar onReset={async () => await chatUIRef.current?.resetChat()} />
      </header>

      {/* Lender Pills - Mobile only, shown between navbar and chat when user has interacted */}
      <LenderPills matches={matches} hasUserInput={hasUserInput} />

      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 relative z-10 w-full flex flex-col min-h-0 overflow-hidden">
        <motion.div 
          layout
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className={`grid grid-cols-1 gap-8 h-full ${
          mode === 'chat' 
            ? expandedPanel === 'chat' 
              ? 'md:grid-cols-1' 
              : expandedPanel === 'matches'
                ? 'md:grid-cols-1'
                : showMatchesPanel 
                  ? 'md:grid-cols-5'
                  : 'md:grid-cols-1'
            : ''
        }`}>
          <motion.div 
            layout
            animate={{
              opacity: expandedPanel === 'matches' ? 0 : 1,
              scale: expandedPanel === 'matches' ? 0.95 : 1
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className={`space-y-6 h-full min-h-0 ${
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
                className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sticky top-8 h-[calc(100vh-8rem)] flex flex-col"
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
                className="w-full h-full min-h-0 flex flex-col overflow-hidden"
              >
                <ChatUI 
                  ref={chatUIRef}
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
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
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
                      <p className="text-sm font-semibold text-slate-900 mb-2">Analyzing your profile</p>
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
                className={`${
                  showMatchesPanel ? 'hidden md:block' : 'hidden'
                } ${
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
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-full flex flex-col relative"
                >
                  <AnimatePresence>
                    {!hasFirstResponse && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-50/80 rounded-2xl flex items-center justify-center backdrop-blur-sm z-10"
                      >
                        <div className="text-center space-y-2">
                          <div className="w-12 h-12 bg-brand-100 rounded-2xl flex items-center justify-center mx-auto">
                            <span className="text-2xl">💬</span>
                          </div>
                          <p className="text-sm font-medium text-slate-700">Start chatting to see your matches</p>
                          <p className="text-xs text-slate-500">Tell Frank about your business needs</p>
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
                        <h2 className="text-xl font-bold text-slate-900">Your Matches</h2>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05, rotate: 5 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleMatchesExpansion}
                        className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-full transition-all duration-300 ease-in-out"
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
                                  'Fast approval with competitive terms',
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
                                'Fast approval with competitive terms',
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
