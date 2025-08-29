import { supabase } from './supabase';
import { AnonymousUserTracker } from './user-tracking';

export interface UserEventData {
  eventName: string;
  eventData?: any;
  pageUrl?: string;
}

export interface ApplicationData {
  lenderId: string;
  profileData: any;
  contactInfo: {
    name: string;
    email: string;
    phone: string;
  };
}

export class DatabaseTracker {
  /**
   * Initialize or update user in database
   */
  static async initializeUser() {
    const session = AnonymousUserTracker.getUserSession();
    
    try {
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('anonymous_users')
        .select('*')
        .eq('user_id', session.userId)
        .single();

      if (!existingUser) {
        // Create new user
        await supabase
          .from('anonymous_users')
          .insert({
            user_id: session.userId,
            device_fingerprint: session.deviceFingerprint,
            metadata: session.metadata,
          });
      } else {
        // Update last seen
        await supabase
          .from('anonymous_users')
          .update({
            last_seen: new Date().toISOString(),
            total_sessions: (existingUser.total_sessions || 0) + 1,
          })
          .eq('user_id', session.userId);
      }

      // Create or update session
      await this.createOrUpdateSession();
    } catch (error) {
      console.error('Error initializing user:', error);
    }
  }

  /**
   * Create or update session
   */
  static async createOrUpdateSession() {
    const session = AnonymousUserTracker.getUserSession();
    
    try {
      // Check if session exists
      const { data: existingSession } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_id', session.sessionId)
        .single();

      if (!existingSession) {
        // Create new session
        await supabase
          .from('user_sessions')
          .insert({
            session_id: session.sessionId,
            user_id: session.userId,
            device_info: session.metadata,
          });
      } else {
        // Update page views
        await supabase
          .from('user_sessions')
          .update({
            page_views: (existingSession.page_views || 0) + 1,
          })
          .eq('session_id', session.sessionId);
      }
    } catch (error) {
      console.error('Error managing session:', error);
    }
  }

  /**
   * Track user event
   */
  static async trackEvent(eventName: string, eventData?: any) {
    const session = AnonymousUserTracker.getUserSession();
    
    try {
      await supabase
        .from('user_events')
        .insert({
          user_id: session.userId,
          session_id: session.sessionId,
          event_name: eventName,
          event_data: eventData || {},
          page_url: typeof window !== 'undefined' ? window.location.href : null,
        });

      // Also track locally
      AnonymousUserTracker.trackEvent(eventName, eventData);
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }

  /**
   * Track loan application
   */
  static async trackApplication(application: ApplicationData) {
    const session = AnonymousUserTracker.getUserSession();
    
    try {
      const { data, error } = await supabase
        .from('applications')
        .insert({
          user_id: session.userId,
          session_id: session.sessionId,
          lender_id: application.lenderId,
          profile_data: application.profileData,
          contact_info: application.contactInfo,
        })
        .select()
        .single();

      if (error) throw error;

      // Track as event too
      await this.trackEvent('application_submitted', {
        lender_id: application.lenderId,
        application_id: data.id,
      });

      return data;
    } catch (error) {
      console.error('Error tracking application:', error);
      return null;
    }
  }

  /**
   * Get user's application history
   */
  static async getUserApplications() {
    const userId = AnonymousUserTracker.getUserId();
    
    try {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          lenders (
            provider,
            product_type,
            logo
          )
        `)
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching applications:', error);
      return [];
    }
  }

  /**
   * Get user's event history
   */
  static async getUserEvents(limit = 50) {
    const userId = AnonymousUserTracker.getUserId();
    
    try {
      const { data, error } = await supabase
        .from('user_events')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  /**
   * End current session
   */
  static async endSession() {
    const sessionId = AnonymousUserTracker.getSessionId();
    
    try {
      await supabase
        .from('user_sessions')
        .update({
          ended_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId);
    } catch (error) {
      console.error('Error ending session:', error);
    }
  }
}