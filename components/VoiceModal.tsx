'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { VoiceClient, VoiceMessage } from '@/lib/voice-client';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: any;
  onProfileUpdate?: (updates: any) => void;
}

export default function VoiceModal({ 
  isOpen, 
  onClose, 
  profile = {},
  onProfileUpdate 
}: VoiceModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [assistantResponse, setAssistantResponse] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  const voiceClientRef = useRef<VoiceClient | null>(null);

  useEffect(() => {
    if (isOpen && !voiceClientRef.current) {
      initializeVoiceClient();
    }

    return () => {
      if (voiceClientRef.current) {
        voiceClientRef.current.disconnect();
        voiceClientRef.current = null;
      }
    };
  }, [isOpen]);

  const initializeVoiceClient = async () => {
    try {
      setIsConnecting(true);
      setConnectionStatus('connecting');
      setError(null);

      // Create instructions based on current profile
      const profileContext = profile ? `
        Current business profile: 
        - Industry: ${profile.industry || 'Not specified'}
        - Years trading: ${profile.yearsTrading || 'Not specified'}
        - Monthly turnover: ${profile.monthlyTurnover ? `R${(profile.monthlyTurnover / 1000).toFixed(0)}k` : 'Not specified'}
        - Amount requested: ${profile.amountRequested ? `R${(profile.amountRequested / 1000).toFixed(0)}k` : 'Not specified'}
        
        Use this context to provide more relevant recommendations.
      ` : '';

      const instructions = `${profileContext}
      
You are Frank, helping South African SMEs find business funding. Keep responses concise for voice - 1-2 sentences max. Ask engaging questions to learn about their business needs.`;

      voiceClientRef.current = new VoiceClient({
        onConnectionChange: (connected) => {
          setIsConnected(connected);
          setConnectionStatus(connected ? 'connected' : 'disconnected');
        },
        onRecordingChange: setIsRecording,
        onError: (errorMsg) => {
          setError(errorMsg);
          setConnectionStatus('error');
        },
        onMessage: handleVoiceMessage
      });

      await voiceClientRef.current.connect();
      setIsConnecting(false);
      
    } catch (error) {
      console.error('Failed to initialize voice client:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect');
      setIsConnecting(false);
      setConnectionStatus('error');
    }
  };

  const handleVoiceMessage = (message: VoiceMessage) => {
    switch (message.type) {
      case 'conversation.item.input_audio_transcription.completed':
        if (message.transcript) {
          setTranscript(message.transcript);
        }
        break;
      case 'response.text.done':
        if (message.text) {
          setAssistantResponse(message.text);
        }
        break;
      case 'response.done':
        // Could extract business info from assistant response here
        // and call onProfileUpdate if needed
        break;
    }
  };

  const handleStartCall = async () => {
    if (!voiceClientRef.current?.connected) {
      await initializeVoiceClient();
    }
    
    try {
      await voiceClientRef.current?.startRecording();
    } catch (error) {
      setError('Failed to start recording. Please check microphone permissions.');
    }
  };

  const handleEndCall = () => {
    voiceClientRef.current?.stopRecording();
    voiceClientRef.current?.disconnect();
    voiceClientRef.current = null;
    setIsConnected(false);
    setIsRecording(false);
    setConnectionStatus('disconnected');
    onClose();
  };

  const toggleMute = () => {
    if (isRecording) {
      voiceClientRef.current?.stopRecording();
    } else {
      voiceClientRef.current?.startRecording();
    }
  };

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
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  Voice Chat with Frank
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-500' : 
                    connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
                    connectionStatus === 'error' ? 'bg-red-500' : 'bg-slate-400'
                  }`} />
                  <span className="text-sm text-slate-600 capitalize">
                    {connectionStatus === 'connecting' ? 'Connecting...' : connectionStatus}
                  </span>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2 text-slate-500 hover:text-slate-700"
              >
                <X size={20} />
              </motion.button>
            </div>

            {/* Error Display */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4"
              >
                <p className="text-red-800 text-sm">{error}</p>
              </motion.div>
            )}

            {/* Voice Visualization */}
            <div className="flex justify-center mb-8">
              <motion.div
                animate={isRecording ? {
                  scale: [1, 1.1, 1],
                  opacity: [0.7, 1, 0.7]
                } : {}}
                transition={isRecording ? {
                  duration: 1,
                  repeat: Infinity,
                  ease: "easeInOut"
                } : {}}
                className={`w-32 h-32 rounded-full flex items-center justify-center ${
                  isRecording 
                    ? 'bg-red-100 border-4 border-red-300'
                    : isConnected
                    ? 'bg-green-100 border-4 border-green-300'
                    : 'bg-slate-100 border-4 border-slate-300'
                }`}
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isRecording ? (
                    <Mic size={40} className="text-red-600" />
                  ) : (
                    <MicOff size={40} className={`${
                      isConnected 
                        ? 'text-green-600'
                        : 'text-slate-500'
                    }`} />
                  )}
                </motion.div>
              </motion.div>
            </div>

            {/* Transcript and Response */}
            {(transcript || assistantResponse) && (
              <div className="mb-6 space-y-3 max-h-32 overflow-y-auto">
                {transcript && (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>You:</strong> {transcript}
                    </p>
                  </div>
                )}
                {assistantResponse && (
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-sm text-green-800">
                      <strong>Frank:</strong> {assistantResponse}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Controls */}
            <div className="flex justify-center gap-4">
              {!isConnected ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleStartCall}
                  disabled={isConnecting}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-full font-medium transition-colors"
                >
                  <Phone size={20} />
                  {isConnecting ? 'Connecting...' : 'Start Call'}
                </motion.button>
              ) : (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleMute}
                    className={`p-3 rounded-full transition-colors ${
                      isRecording
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-slate-600 hover:bg-slate-700 text-white'
                    }`}
                  >
                    {isRecording ? <Mic size={20} /> : <MicOff size={20} />}
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleEndCall}
                    className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-medium transition-colors"
                  >
                    <PhoneOff size={20} />
                    End Call
                  </motion.button>
                </>
              )}
            </div>

            {/* Instructions */}
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                {!isConnected ? 
                  'Click "Start Call" to begin your voice conversation with Frank' :
                  isRecording ? 
                    'Speak now - Frank is listening...' :
                    'Click the microphone to talk to Frank'
                }
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}