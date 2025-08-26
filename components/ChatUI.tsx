'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import PersonalityModal from './PersonalityModal';

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
  onMessage: (message: string, chatHistory?: Array<{role: string, content: string}>, personality?: string) => Promise<string>;
}

export default function ChatUI({ onMessage }: ChatUIProps) {
  const [showPersonalityModal, setShowPersonalityModal] = useState(false);
  const [personality, setPersonality] = useState('Professional and friendly. Be helpful and informative while maintaining a warm tone.');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: 'Hi, I\'m Frank. I\'ll match you to real South African funding options.\n\nTo find your best matches, I need to know:\n\n**Essential information:**\n- Your industry\n- Years in business\n- Monthly turnover (R)\n- How much funding you need (R)\n\n**Also helpful:**\n- VAT registration status\n- What you need the funding for\n- How urgently you need it\n- Your province\n\nOnce I have the essential details, I\'ll show you live funding matches on the right.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      // Convert messages to chat history format
      const chatHistory = messages.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
      
      const response = await onMessage(userMessage.content, chatHistory, personality);
      
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
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
            F
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Frank</h3>
            <p className="text-xs text-gray-500">AI Funding Advisor</p>
          </div>
        </div>
        <button
          onClick={() => setShowPersonalityModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          title="Customize Frank's personality"
        >
          <Sparkles size={16} />
          <span>Personality</span>
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex items-start gap-2 max-w-[80%] ${
                  message.type === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                {message.type === 'bot' && (
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    F
                  </div>
                )}
                <div
                  className={`px-4 py-2 rounded-2xl ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div 
                    className="whitespace-pre-wrap font-sans"
                    dangerouslySetInnerHTML={{
                      __html: formatMessage(message.content)
                    }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {sending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                F
              </div>
              <div className="bg-gray-100 rounded-2xl px-4 py-2">
                <div className="flex gap-1">
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-2 h-2 bg-gray-400 rounded-full"
                  />
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                    className="w-2 h-2 bg-gray-400 rounded-full"
                  />
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                    className="w-2 h-2 bg-gray-400 rounded-full"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type here..."
            disabled={sending}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
      
      <PersonalityModal
        isOpen={showPersonalityModal}
        onClose={() => setShowPersonalityModal(false)}
        currentPersonality={personality}
        onSave={(newPersonality) => setPersonality(newPersonality)}
      />
    </div>
  );
}