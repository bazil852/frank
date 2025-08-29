-- Run this in your Supabase SQL Editor to apply all missing migrations

-- Migration 005: Add reset business profile functions
-- Function to reset only business profile data while preserving anonymous user identity
CREATE OR REPLACE FUNCTION reset_user_business_profile(p_user_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- Clear business profile but keep user identity and tracking data
    UPDATE public.anonymous_users 
    SET 
        business_profile = '{}'::JSONB,
        last_seen = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Clear conversation summaries profile snapshot but keep other metadata
    UPDATE public.conversation_summaries
    SET 
        profile_snapshot = '{}'::JSONB,
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clear conversation history but preserve user profile and identity
CREATE OR REPLACE FUNCTION clear_conversation_history_only(p_user_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- Delete conversation messages
    DELETE FROM public.conversations 
    WHERE user_id = p_user_id;
    
    -- Reset conversation summary message data but keep profile
    UPDATE public.conversation_summaries
    SET 
        last_message = NULL,
        message_count = 0,
        last_activity = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Note: We intentionally preserve:
    -- - anonymous_users record (user_id, device_fingerprint, first_seen, total_sessions, metadata)
    -- - user_sessions records (for analytics and tracking)
    -- - user_events records (for behavior analysis)
    -- - applications records (for application history)
END;
$$ LANGUAGE plpgsql;

-- Also ensure the business_profile column exists on anonymous_users
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'anonymous_users' 
        AND column_name = 'business_profile'
    ) THEN
        ALTER TABLE public.anonymous_users 
        ADD COLUMN business_profile JSONB DEFAULT '{}';
        
        CREATE INDEX IF NOT EXISTS idx_anonymous_users_business_profile 
        ON public.anonymous_users USING GIN (business_profile);
    END IF;
END $$;