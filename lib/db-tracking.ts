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
  
  static async initializeUser() {
    const session = AnonymousUserTracker.getUserSession();
    
    try {
      
      const { data: existingUser } = await supabase
        .from('anonymous_users')
        .select('*')
        .eq('user_id', session.userId)
        .single();

      if (!existingUser) {
        
        await supabase
          .from('anonymous_users')
          .insert({
            user_id: session.userId,
            device_fingerprint: session.deviceFingerprint,
            metadata: session.metadata,
          });
      } else {
        
        await supabase
          .from('anonymous_users')
          .update({
            last_seen: new Date().toISOString(),
            total_sessions: (existingUser.total_sessions || 0) + 1,
          })
          .eq('user_id', session.userId);
      }

      await this.createOrUpdateSession();
    } catch (error) {
      console.error('Error initializing user:', error);
    }
  }

  static async createOrUpdateSession() {
    const session = AnonymousUserTracker.getUserSession();
    
    try {
      
      const { data: existingSession } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_id', session.sessionId)
        .single();

      if (!existingSession) {
        
        await supabase
          .from('user_sessions')
          .insert({
            session_id: session.sessionId,
            user_id: session.userId,
            device_info: session.metadata,
          });
      } else {
        
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

      AnonymousUserTracker.trackEvent(eventName, eventData);
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }

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