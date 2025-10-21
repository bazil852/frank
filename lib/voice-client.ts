import { supabase } from './supabase';

export interface VoiceSession {
  id: string;
  client_secret: string;
  expires_at: string;
  model: string;
  voice: string;
}

export interface VoiceMessage {
  type: string;
  [key: string]: any;
}

export class VoiceClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private isRecording = false;
  private isConnected = false;
  private session: VoiceSession | null = null;
  private onMessage?: (message: VoiceMessage) => void;
  private onConnectionChange?: (connected: boolean) => void;
  private onRecordingChange?: (recording: boolean) => void;
  private onError?: (error: string) => void;

  constructor(callbacks: {
    onMessage?: (message: VoiceMessage) => void;
    onConnectionChange?: (connected: boolean) => void;
    onRecordingChange?: (recording: boolean) => void;
    onError?: (error: string) => void;
  } = {}) {
    this.onMessage = callbacks.onMessage;
    this.onConnectionChange = callbacks.onConnectionChange;
    this.onRecordingChange = callbacks.onRecordingChange;
    this.onError = callbacks.onError;
  }

  async createSession(instructions?: string): Promise<VoiceSession> {
    try {
      console.log('Creating voice session with Supabase function...');
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/voice-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ instructions }),
      });

      console.log('Supabase function response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Supabase function error response:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Failed to create voice session');
        } catch {
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      }

      const data = await response.json();
      console.log('Voice session created successfully:', data);
      this.session = data.session;
      return data.session;
    } catch (error) {
      console.error('Session creation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.onError?.(errorMessage);
      throw error;
    }
  }

  async connect(): Promise<void> {
    if (!this.session) {
      await this.createSession();
    }

    return new Promise((resolve, reject) => {
      try {

        const wsUrl = `wss:
        console.log('Connecting to WebSocket with model:', this.session!.model);
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('Voice WebSocket connected, sending session update...');
          
          this.isConnected = true;
          this.onConnectionChange?.(true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing voice message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('Voice WebSocket error:', error);
          this.onError?.('Voice connection error');
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('Voice WebSocket disconnected');
          this.isConnected = false;
          this.onConnectionChange?.(false);
          this.cleanup();
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(message: VoiceMessage): void {
    console.log('Voice message received:', message.type, message);
    
    switch (message.type) {
      case 'session.created':
        console.log('Voice session created successfully');
        break;
      case 'input_audio_buffer.speech_started':
        console.log('Speech started');
        break;
      case 'input_audio_buffer.speech_stopped':
        console.log('Speech stopped');
        break;
      case 'response.audio.delta':
        if (message.delta) {
          this.playAudioDelta(message.delta);
        }
        break;
      case 'response.text.done':
        console.log('Assistant response:', message.text);
        break;
      case 'error':
        console.error('Voice API error details:', JSON.stringify(message, null, 2));
        const errorMsg = message.error?.message || message.message || 'Voice API error';
        this.onError?.(errorMsg);
        break;
      default:
        console.log('Unhandled message type:', message.type, message);
        break;
    }

    this.onMessage?.(message);
  }

  private async playAudioDelta(audioData: string): Promise<void> {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const binaryString = atob(audioData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
      
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  async startRecording(): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Voice connection not established');
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
          
          const reader = new FileReader();
          reader.onload = () => {
            const audioData = reader.result as string;
            const base64Data = audioData.split(',')[1];
            this.sendMessage({
              type: 'input_audio_buffer.append',
              audio: base64Data
            });
          };
          reader.readAsDataURL(event.data);
        }
      };

      this.mediaRecorder.start(100); 
      this.isRecording = true;
      this.onRecordingChange?.(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      this.onError?.(errorMessage);
      throw error;
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.onRecordingChange?.(false);

      this.sendMessage({
        type: 'input_audio_buffer.commit'
      });

      this.sendMessage({
        type: 'response.create'
      });
    }
  }

  sendMessage(message: VoiceMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isRecording = false;
    this.isConnected = false;
    this.mediaRecorder = null;
    this.session = null;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get recording(): boolean {
    return this.isRecording;
  }
}