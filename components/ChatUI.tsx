'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
import { Send } from 'lucide-react';
import { ConversationTracker } from '@/lib/db-conversations';
import ChipsBar from './ChipsBar';

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

export interface ChatUIRef {
  resetChat: () => Promise<void>;
}

const ChatUI = forwardRef<ChatUIRef, ChatUIProps>(({ 
  onMessage, 
  onReset, 
  profile = {}, 
  showChips = false,
  hideMobileFeatures = false
}, ref) => {
  const [personality, setPersonality] = useState('Professional and friendly. Be helpful and informative while maintaining a warm tone.');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [messageIndex, setMessageIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasLoadedHistory = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Expose reset function to parent component
  useImperativeHandle(ref, () => ({
    resetChat: async () => {
      try {
        // Clear conversation history from database
        await ConversationTracker.clearConversationHistory();
        
        // Reset local state with empty messages (no initial message)
        setMessages([]);
        
        setInput('');
        setMessageIndex(0);
        setSending(false);
        
        // Notify parent component to reset its state
        if (onReset) {
          onReset();
        }
        
        console.log('Chat reset completed');
      } catch (error) {
        console.error('Error resetting chat:', error);
      }
    }
  }));

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
            // No history, start with empty messages for welcome screen
            setMessages([]);
          }
        } else {
          // First time user, start with empty messages for welcome screen
          setMessages([]);
        }
      } catch (error) {
        console.error('Error loading conversation history:', error);
        // Fallback to empty messages for welcome screen
        setMessages([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadConversationHistory();
  }, []);

  // Better autoscroll that accounts for animation timing
  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  useLayoutEffect(() => {
    // Wait one frame so Framer Motion can finish inserting/animating nodes
    requestAnimationFrame(scrollToBottom);
  }, [messages, sending]);

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
      
      // Add bot message with typing animation
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


  return (
    <div className="w-full h-full min-h-0 flex flex-col bg-transparent rounded-2xl overflow-hidden">
      {/* Chips Section */}
      {showChips && !hideMobileFeatures && (
        <div className="hidden md:block px-6 py-4 bg-transparent flex-shrink-0">
          <ChipsBar profile={profile} />
        </div>
      )}
      
      {/* Scrollable Chat Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 space-y-4 bg-transparent scrollbar-hide">
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
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="text-center max-w-md mx-auto px-4"
            >
              <motion.h1 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-4xl font-bold text-slate-800 mb-4"
              >
                Hey, Let&apos;s get started
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-lg text-slate-600"
              >
                Tell me about your business and what you need funding for.
              </motion.p>
            </motion.div>
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
                  className={`${
                    message.type === 'user'
                      ? 'px-5 py-3 rounded-2xl bg-slate-800 text-white shadow-md'
                      : 'text-slate-800'
                  }`}
                >
                  <div 
                    className={`whitespace-pre-wrap leading-relaxed ${
                      message.type === 'user' ? 'text-white' : 'text-slate-700'
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
              <div className="bg-transparent rounded-2xl px-4 py-2">
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
        {/* Sentinel element for accurate scrolling */}
        <div ref={endRef} />
      </div>
      
      {/* Input at Bottom */}
      <div className="flex-shrink-0 p-5 bg-white/50 backdrop-blur-sm border-t border-slate-200">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message..."
            disabled={sending}
            className="w-full px-6 py-4 pr-24 bg-transparent border-2 border-slate-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-slate-700 disabled:opacity-50 text-slate-900 placeholder-slate-500 transition-all duration-200"
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="w-10 h-10 bg-slate-900 hover:bg-slate-800 rounded-full flex items-center justify-center text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <Send size={18} />
            </motion.button>
          </div>
        </div>
      </div>
      
    </div>
  );
});

ChatUI.displayName = 'ChatUI';

export default ChatUI;