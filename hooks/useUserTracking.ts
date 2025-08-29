import { useEffect, useRef } from 'react';
import { AnonymousUserTracker } from '@/lib/user-tracking';
import { DatabaseTracker } from '@/lib/db-tracking';

export function useUserTracking() {
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current && typeof window !== 'undefined') {
      isInitialized.current = true;

      // Initialize user tracking
      const initTracking = async () => {
        try {
          // Initialize user in database
          await DatabaseTracker.initializeUser();
          
          // Track page view
          await DatabaseTracker.trackEvent('page_view', {
            page: window.location.pathname,
            referrer: document.referrer,
          });

          // Log user info for debugging
          const session = AnonymousUserTracker.getUserSession();
          console.log('User tracking initialized:', {
            userId: session.userId,
            sessionId: session.sessionId,
            fingerprint: session.deviceFingerprint,
          });
        } catch (error) {
          console.error('Error initializing tracking:', error);
        }
      };

      initTracking();

      // Track when user leaves
      const handleBeforeUnload = () => {
        DatabaseTracker.endSession();
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, []);

  return {
    userId: AnonymousUserTracker.getUserId(),
    sessionId: AnonymousUserTracker.getSessionId(),
    trackEvent: DatabaseTracker.trackEvent,
    trackApplication: DatabaseTracker.trackApplication,
  };
}