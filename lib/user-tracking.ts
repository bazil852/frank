import { v4 as uuidv4 } from 'uuid';

interface UserSession {
  sessionId: string;
  userId: string;
  createdAt: string;
  lastSeen: string;
  deviceFingerprint: string;
  metadata?: {
    userAgent?: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
    platform?: string;
  };
}

export class AnonymousUserTracker {
  private static readonly USER_ID_KEY = 'frank_anonymous_user_id';
  private static readonly SESSION_ID_KEY = 'frank_session_id';
  private static readonly SESSION_TIMEOUT = 30 * 60 * 1000; 

  static getUserId(): string {
    if (typeof window === 'undefined') return '';
    
    let userId = localStorage.getItem(this.USER_ID_KEY);
    
    if (!userId) {
      userId = `user_${uuidv4()}`;
      localStorage.setItem(this.USER_ID_KEY, userId);
    }
    
    return userId;
  }

  static getSessionId(): string {
    if (typeof window === 'undefined') return '';
    
    const now = new Date().getTime();
    const sessionData = sessionStorage.getItem(this.SESSION_ID_KEY);
    
    if (sessionData) {
      const { id, lastActivity } = JSON.parse(sessionData);
      
      if (now - lastActivity < this.SESSION_TIMEOUT) {
        
        sessionStorage.setItem(
          this.SESSION_ID_KEY,
          JSON.stringify({ id, lastActivity: now })
        );
        return id;
      }
    }

    const newSessionId = `session_${uuidv4()}`;
    sessionStorage.setItem(
      this.SESSION_ID_KEY,
      JSON.stringify({ id: newSessionId, lastActivity: now })
    );
    
    return newSessionId;
  }

  static getDeviceFingerprint(): string {
    if (typeof window === 'undefined') return '';
    
    const fingerprint = {
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      colorDepth: window.screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      plugins: Array.from(navigator.plugins || []).map(p => p.name).join(','),
    };

    const fingerprintString = JSON.stringify(fingerprint);
    let hash = 0;
    for (let i = 0; i < fingerprintString.length; i++) {
      const char = fingerprintString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `fp_${Math.abs(hash).toString(36)}`;
  }

  static getUserSession(): UserSession {
    return {
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
      deviceFingerprint: this.getDeviceFingerprint(),
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      metadata: {
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
      }
    };
  }

  static async trackEvent(eventName: string, eventData?: any) {
    const session = this.getUserSession();

    this.getSessionId(); 
  }

  static clearUserData() {
    localStorage.removeItem(this.USER_ID_KEY);
    sessionStorage.removeItem(this.SESSION_ID_KEY);
  }
}