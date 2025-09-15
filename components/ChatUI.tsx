'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { Send, RotateCcw, Sparkles, Maximize2, Minimize2, Mic } from 'lucide-react';
import { ConversationTracker } from '@/lib/db-conversations';
import { AnonymousUserTracker } from '@/lib/user-tracking';
import ChipsBar from './ChipsBar';
import VoiceModal from './VoiceModal';

function formatMessage(content: string): string {
  return content
    // Convert **bold** to <strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Convert numbered lists
    .replace(/^(\d+)\.\s+\*\*(.*?)\*\*:\s*(.*?)$/gm, '<div class="mb-2"><strong>$1. $2:</strong> $3</div>')
    // Convert bullet points
    .replace(/^-\s+(.*?)$/gm, '<div class="ml-4">• $1</div>')
    // Convert line breaks
    .replace(/\n/g, '<br />');
}

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

interface ChatUIProps {
  onMessage: (message: string, chatHistory?: Array<{role: 'system' | 'user' | 'assistant', content: string}>, personality?: string) => Promise<string>;
  onReset?: () => void;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
  showProfileProgress?: boolean;
  profile?: any;
  showChips?: boolean;
  hideMobileFeatures?: boolean;
  onProfileUpdate?: (updates: any) => void;
}

export default function ChatUI({ 
  onMessage, 
  onReset, 
  onToggleExpand, 
  isExpanded = false, 
  showProfileProgress = false, 
  profile = {}, 
  showChips = false,
  hideMobileFeatures = false,
  onProfileUpdate
}: ChatUIProps) {
  const [personality, setPersonality] = useState('Professional and friendly. Be helpful and informative while maintaining a warm tone.');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [messageIndex, setMessageIndex] = useState(0);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasLoadedHistory = useRef(false);

  // Load conversation history on component mount
  useEffect(() => {
    const loadConversationHistory = async () => {
      if (hasLoadedHistory.current) return;
      hasLoadedHistory.current = true;
      
      try {
        setLoadingHistory(true);
        
        // Check if user has conversation history
        const hasHistory = await ConversationTracker.hasConversationHistory();
        
        if (hasHistory) {
          // Load previous conversations
          const history = await ConversationTracker.getConversationHistory();
          const summary = await ConversationTracker.getConversationSummary();
          
          if (summary?.personality) {
            setPersonality(summary.personality);
          }
          
          if (history.length > 0) {
            // Convert conversation history to Message format
            const loadedMessages: Message[] = history.map((msg, idx) => ({
              id: `loaded-${idx}`,
              type: msg.role === 'user' ? 'user' : 'bot',
              content: msg.content,
              timestamp: new Date(),
            }));
            
            // Add welcome back message
            loadedMessages.push({
              id: 'welcome-back',
              type: 'bot',
              content: 'Welcome back! I can see our previous conversation. Feel free to continue where we left off or start something new.',
              timestamp: new Date(),
            });
            
            setMessages(loadedMessages);
            const latestIndex = await ConversationTracker.getLatestMessageIndex();
            setMessageIndex(latestIndex);
          } else {
            // No history, show initial message
            setMessages([{
              id: '1',
              type: 'bot',
              content: 'I\'m Frank — I show you what funding you actually qualify for. No BS, no dead ends.\n\nHere\'s how I help:\n\n**Check eligibility** → I stack your business up against what lenders are actually looking for — revenue, time trading, VAT, collateral. If you\'re in, you\'re in. If not, at least you know before wasting time.\n\n**Find your fit** → From the options you qualify for, we talk through which ones make the most sense for you — whether you care more about speed, size, or cost.\n\n**Explain stuff** → If something sounds like finance-speak (like "working capital facility"), I\'ll strip it back to plain English.\n\n**Enable applications** → Ready to go? I set you up to apply to one or all your options in one shot — no juggling forms, no repeated paperwork.\n\nNow, tell me about your business — how long you\'ve been running, your turnover, and if you\'re registered. The more you share, the faster I can get you matched.',
              timestamp: new Date(),
            }]);
          }
        } else {
          // First time user
          setMessages([{
            id: '1',
            type: 'bot',
            content: 'I\'m Frank — I show you what funding you actually qualify for. No BS, no dead ends.\n\nHere\'s how I help:\n\n**Check eligibility** → I stack your business up against what lenders are actually looking for — revenue, time trading, VAT, collateral. If you\'re in, you\'re in. If not, at least you know before wasting time.\n\n**Find your fit** → From the options you qualify for, we talk through which ones make the most sense for you — whether you care more about speed, size, or cost.\n\n**Explain stuff** → If something sounds like finance-speak (like "working capital facility"), I\'ll strip it back to plain English.\n\n**Enable applications** → Ready to go? I set you up to apply to one or all your options in one shot — no juggling forms, no repeated paperwork.\n\nNow, tell me about your business — how long you\'ve been running, your turnover, and if you\'re registered. The more you share, the faster I can get you matched.',
            timestamp: new Date(),
          }]);
        }
      } catch (error) {
        console.error('Error loading conversation history:', error);
        // Fallback to default message
        setMessages([{
          id: '1',
          type: 'bot',
          content: 'I\'m Frank — I show you what funding you actually qualify for. No BS, no dead ends.\n\nHere\'s how I help:\n\n**Check eligibility** → I stack your business up against what lenders are actually looking for — revenue, time trading, VAT, collateral. If you\'re in, you\'re in. If not, at least you know before wasting time.\n\n**Find your fit** → From the options you qualify for, we talk through which ones make the most sense for you — whether you care more about speed, size, or cost.\n\n**Explain stuff** → If something sounds like finance-speak (like "working capital facility"), I\'ll strip it back to plain English.\n\n**Enable applications** → Ready to go? I set you up to apply to one or all your options in one shot — no juggling forms, no repeated paperwork.\n\nNow, tell me about your business — how long you\'ve been running, your turnover, and if you\'re registered. The more you share, the faster I can get you matched.',
          timestamp: new Date(),
        }]);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadConversationHistory();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      // Save user message to database
      await ConversationTracker.saveMessage(
        'user',
        userMessage.content,
        messageIndex,
        { personality }
      );
      setMessageIndex(prev => prev + 1);

      // Convert messages to chat history format
      const chatHistory = messages.map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));
      
      const response = await onMessage(userMessage.content, chatHistory, personality);
      
      // Save bot response to database
      await ConversationTracker.saveMessage(
        'assistant',
        response,
        messageIndex + 1,
        {}
      );
      setMessageIndex(prev => prev + 1);

      // Update conversation metadata with personality
      await ConversationTracker.updateConversationMetadata({}, personality);
      
      setTimeout(() => {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        setSending(false);
      }, 400 + Math.random() * 300);
    } catch (error) {
      console.error('Error in chat:', error);
      setSending(false);
    }
  };

  const handleResetChat = async () => {
    try {
      // Clear conversation history from database
      await ConversationTracker.clearConversationHistory();
      
      // Reset local state
      setMessages([{
        id: '1',
        type: 'bot',
        content: 'I\'m Frank — I show you what funding you actually qualify for. No BS, no dead ends.\n\nHere\'s how I help:\n\n**Check eligibility** → I stack your business up against what lenders are actually looking for — revenue, time trading, VAT, collateral. If you\'re in, you\'re in. If not, at least you know before wasting time.\n\n**Find your fit** → From the options you qualify for, we talk through which ones make the most sense for you — whether you care more about speed, size, or cost.\n\n**Explain stuff** → If something sounds like finance-speak (like "working capital facility"), I\'ll strip it back to plain English.\n\n**Enable applications** → Ready to go? I set you up to apply to one or all your options in one shot — no juggling forms, no repeated paperwork.\n\nNow, tell me about your business — how long you\'ve been running, your turnover, and if you\'re registered. The more you share, the faster I can get you matched.',
        timestamp: new Date(),
      }]);
      
      setInput('');
      setMessageIndex(0);
      
      // Notify parent component to reset its state
      if (onReset) {
        onReset();
      }
      
      console.log('Chat reset completed');
    } catch (error) {
      console.error('Error resetting chat:', error);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors duration-200">
      <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-sm">
              F
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white"></div>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 transition-colors duration-200">Frank</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onToggleExpand && !hideMobileFeatures && (
            <motion.button
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleExpand}
              className="hidden md:flex p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full transition-all duration-300 ease-in-out"
              title={isExpanded ? "Minimize chat" : "Expand chat"}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </motion.div>
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleResetChat}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full transition-all duration-200"
            title="Start a fresh conversation"
          >
            <RotateCcw size={14} />
            <span className="font-medium">New Chat</span>
          </motion.button>
        </div>
      </div>
      {/* Chips Section */}
      {showChips && !hideMobileFeatures && (
        <div className="hidden md:block px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors duration-200">
          <ChipsBar profile={profile} />
        </div>
      )}
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50 dark:bg-slate-800 transition-colors duration-200">
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="inline-block w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full mb-4"
              />
              <p className="text-slate-500 text-sm font-medium">Loading conversation history...</p>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex items-start gap-3 max-w-[75%] ${
                  message.type === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                {message.type === 'bot' && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm"
                  >
                    F
                  </motion.div>
                )}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  className={`px-5 py-3 rounded-2xl ${
                    message.type === 'user'
                      ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-md'
                      : 'bg-brand-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-brand-100 dark:border-slate-600 shadow-sm'
                  }`}
                >
                  <div 
                    className={`whitespace-pre-wrap leading-relaxed ${
                      message.type === 'user' ? 'text-white' : 'text-slate-700 dark:text-slate-100'
                    }`}
                    dangerouslySetInnerHTML={{
                      __html: formatMessage(message.content)
                    }}
                  />
                </motion.div>
              </div>
            </motion.div>
            ))}
          </AnimatePresence>
        )}
        {sending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm">
                F
              </div>
              <div className="bg-brand-50 dark:bg-slate-700 border border-brand-100 dark:border-slate-600 rounded-2xl px-4 py-2 transition-colors duration-200">
                <div className="flex gap-1.5">
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-2 h-2 bg-brand-600 rounded-full"
                  />
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                    className="w-2 h-2 bg-brand-600 rounded-full"
                  />
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                    className="w-2 h-2 bg-brand-600 rounded-full"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-b-2xl transition-colors duration-200">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message..."
            disabled={sending}
            className="w-full px-6 py-4 pr-24 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600 disabled:opacity-50 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 transition-all duration-200"
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowVoiceModal(true)}
              className="w-10 h-10 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-sm transition-all duration-200"
              title="Voice chat"
            >
              <Mic size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <Send size={18} />
            </motion.button>
          </div>
        </div>
      </div>
      
      <VoiceModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        profile={profile}
        onProfileUpdate={onProfileUpdate}
      />
    </div>
  );
}