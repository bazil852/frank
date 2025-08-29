import { supabase } from './supabase';
import { AnonymousUserTracker } from './user-tracking';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
}

export interface ConversationData {
  messages: ConversationMessage[];
  profile?: any;
  personality?: string;
}

export class ConversationTracker {
  /**
   * Save a single message to the conversation history
   */
  static async saveMessage(
    role: 'user' | 'assistant',
    content: string,
    messageIndex: number,
    metadata?: any
  ) {
    const userId = AnonymousUserTracker.getUserId();
    const sessionId = AnonymousUserTracker.getSessionId();
    
    if (!userId) {
      console.error('No user ID available for saving conversation');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          session_id: sessionId,
          message_index: messageIndex,
          role,
          content,
          metadata: metadata || {}
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving conversation message:', error);
      return null;
    }
  }

  /**
   * Save multiple messages at once (batch save)
   */
  static async saveConversation(
    messages: ConversationMessage[],
    startIndex: number = 0
  ) {
    const userId = AnonymousUserTracker.getUserId();
    const sessionId = AnonymousUserTracker.getSessionId();
    
    if (!userId || messages.length === 0) return [];

    try {
      const conversationData = messages.map((msg, idx) => ({
        user_id: userId,
        session_id: sessionId,
        message_index: startIndex + idx,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata || {}
      }));

      const { data, error } = await supabase
        .from('conversations')
        .insert(conversationData)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving conversation:', error);
      return [];
    }
  }

  /**
   * Retrieve conversation history for the current user
   */
  static async getConversationHistory(limit: number = 100): Promise<ConversationMessage[]> {
    const userId = AnonymousUserTracker.getUserId();
    
    if (!userId) {
      console.log('No user ID available for retrieving conversation');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('message_index', { ascending: true })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        metadata: msg.metadata
      }));
    } catch (error) {
      console.error('Error retrieving conversation history:', error);
      return [];
    }
  }

  /**
   * Get conversation summary for the user
   */
  static async getConversationSummary() {
    const userId = AnonymousUserTracker.getUserId();
    
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('conversation_summaries')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return data;
    } catch (error) {
      console.error('Error retrieving conversation summary:', error);
      return null;
    }
  }

  /**
   * Clear conversation history for the current user (preserves anonymous profile)
   */
  static async clearConversationHistory() {
    const userId = AnonymousUserTracker.getUserId();
    
    if (!userId) return false;

    try {
      // Use the new database function that preserves user identity
      const { error } = await supabase.rpc('clear_conversation_history_only', {
        p_user_id: userId
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error clearing conversation history:', error);
      return false;
    }
  }

  /**
   * Reset user's business profile while preserving anonymous identity
   */
  static async resetUserBusinessProfile() {
    const userId = AnonymousUserTracker.getUserId();
    
    if (!userId) return false;

    try {
      const { error } = await supabase.rpc('reset_user_business_profile', {
        p_user_id: userId
      });

      if (error) throw error;
      console.log('Reset business profile for user:', userId);
      return true;
    } catch (error) {
      console.error('Error resetting user business profile:', error);
      return false;
    }
  }

  /**
   * Get the latest message index for continuing conversation
   */
  static async getLatestMessageIndex(): Promise<number> {
    const userId = AnonymousUserTracker.getUserId();
    
    if (!userId) return 0;

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('message_index')
        .eq('user_id', userId)
        .order('message_index', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? data.message_index + 1 : 0;
    } catch (error) {
      console.error('Error getting latest message index:', error);
      return 0;
    }
  }

  /**
   * Check if user has previous conversations
   */
  static async hasConversationHistory(): Promise<boolean> {
    const userId = AnonymousUserTracker.getUserId();
    
    if (!userId) return false;

    try {
      const { count, error } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) throw error;
      return (count || 0) > 0;
    } catch (error) {
      console.error('Error checking conversation history:', error);
      return false;
    }
  }

  /**
   * Update conversation with profile and personality data
   */
  static async updateConversationMetadata(profile: any, personality?: string) {
    const userId = AnonymousUserTracker.getUserId();
    
    if (!userId) return;

    try {
      // Update conversation summary
      await supabase
        .from('conversation_summaries')
        .upsert({
          user_id: userId,
          profile_snapshot: profile,
          personality: personality,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      // Also update the user's business profile for personalization
      if (profile && Object.keys(profile).length > 0) {
        await this.updateUserBusinessProfile(profile);
      }
    } catch (error) {
      console.error('Error updating conversation metadata:', error);
    }
  }

  /**
   * Update user's business profile in the database
   */
  static async updateUserBusinessProfile(profileData: any) {
    const userId = AnonymousUserTracker.getUserId();
    
    if (!userId) return;

    try {
      // Use the database function to merge profile data
      const { error } = await supabase.rpc('update_user_business_profile', {
        p_user_id: userId,
        p_profile_data: profileData
      });

      if (error) throw error;
      console.log('Updated user business profile:', profileData);
    } catch (error) {
      console.error('Error updating user business profile:', error);
    }
  }

  /**
   * Get user's business profile from database
   */
  static async getUserBusinessProfile() {
    const userId = AnonymousUserTracker.getUserId();
    
    if (!userId) return {};

    try {
      const { data, error } = await supabase.rpc('get_user_business_profile', {
        p_user_id: userId
      });

      if (error) throw error;
      return data || {};
    } catch (error) {
      console.error('Error getting user business profile:', error);
      return {};
    }
  }

  /**
   * Get complete user context (profile + conversation history)
   */
  static async getUserContext() {
    const userId = AnonymousUserTracker.getUserId();
    
    if (!userId) return { profile: {}, messages: [], hasHistory: false };

    try {
      const [profile, messages, summary] = await Promise.all([
        this.getUserBusinessProfile(),
        this.getConversationHistory(),
        this.getConversationSummary()
      ]);

      return {
        userId,
        profile,
        messages,
        personality: summary?.personality,
        hasHistory: messages.length > 0,
        lastActivity: summary?.last_activity
      };
    } catch (error) {
      console.error('Error getting user context:', error);
      return { profile: {}, messages: [], hasHistory: false };
    }
  }
}