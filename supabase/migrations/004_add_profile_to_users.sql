-- Add business profile fields to anonymous_users table
ALTER TABLE public.anonymous_users 
ADD COLUMN IF NOT EXISTS business_profile JSONB DEFAULT '{}';

-- Add index for business profile queries
CREATE INDEX IF NOT EXISTS idx_anonymous_users_business_profile 
ON public.anonymous_users USING GIN (business_profile);

-- Function to update user business profile
CREATE OR REPLACE FUNCTION update_user_business_profile(
    p_user_id TEXT,
    p_profile_data JSONB
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.anonymous_users 
    SET 
        business_profile = COALESCE(business_profile, '{}'::JSONB) || p_profile_data,
        last_seen = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- If user doesn't exist, create them
    IF NOT FOUND THEN
        INSERT INTO public.anonymous_users (
            user_id, 
            business_profile, 
            first_seen, 
            last_seen
        ) VALUES (
            p_user_id, 
            p_profile_data, 
            NOW(), 
            NOW()
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get user business profile
CREATE OR REPLACE FUNCTION get_user_business_profile(p_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
    profile_data JSONB;
BEGIN
    SELECT business_profile 
    INTO profile_data
    FROM public.anonymous_users 
    WHERE user_id = p_user_id;
    
    RETURN COALESCE(profile_data, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- Update conversation summaries to sync with user profile
CREATE OR REPLACE FUNCTION sync_conversation_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Update conversation summary with latest profile data
    UPDATE public.conversation_summaries
    SET 
        profile_snapshot = NEW.business_profile,
        updated_at = NOW()
    WHERE user_id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync profile updates to conversation summaries
DROP TRIGGER IF EXISTS sync_profile_to_conversations ON public.anonymous_users;
CREATE TRIGGER sync_profile_to_conversations
    AFTER UPDATE OF business_profile ON public.anonymous_users
    FOR EACH ROW
    WHEN (OLD.business_profile IS DISTINCT FROM NEW.business_profile)
    EXECUTE FUNCTION sync_conversation_profile();