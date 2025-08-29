-- Create conversations table to store chat history
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.anonymous_users(user_id) ON DELETE CASCADE,
    session_id TEXT REFERENCES public.user_sessions(session_id),
    message_index INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create conversation summaries table for quick overview
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.anonymous_users(user_id) ON DELETE CASCADE,
    last_message TEXT,
    message_count INTEGER DEFAULT 0,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    profile_snapshot JSONB DEFAULT '{}',
    personality TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_session_id ON public.conversations(session_id);
CREATE INDEX idx_conversations_created_at ON public.conversations(created_at DESC);
CREATE INDEX idx_conversations_user_message_index ON public.conversations(user_id, message_index);
CREATE INDEX idx_conversation_summaries_user_id ON public.conversation_summaries(user_id);
CREATE INDEX idx_conversation_summaries_last_activity ON public.conversation_summaries(last_activity DESC);

-- Disable RLS for conversation tables (as requested - no auth required)
ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries DISABLE ROW LEVEL SECURITY;

-- Function to update conversation summary
CREATE OR REPLACE FUNCTION update_conversation_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert conversation summary
    INSERT INTO public.conversation_summaries (
        user_id,
        last_message,
        message_count,
        last_activity,
        profile_snapshot,
        personality
    )
    VALUES (
        NEW.user_id,
        NEW.content,
        1,
        NOW(),
        COALESCE(NEW.metadata->>'profile', '{}')::JSONB,
        NEW.metadata->>'personality'
    )
    ON CONFLICT (user_id) DO UPDATE SET
        last_message = EXCLUDED.last_message,
        message_count = conversation_summaries.message_count + 1,
        last_activity = NOW(),
        profile_snapshot = CASE 
            WHEN EXCLUDED.profile_snapshot != '{}'::JSONB 
            THEN EXCLUDED.profile_snapshot 
            ELSE conversation_summaries.profile_snapshot 
        END,
        personality = COALESCE(EXCLUDED.personality, conversation_summaries.personality),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update summary when new conversation message is added
CREATE TRIGGER update_summary_on_conversation
    AFTER INSERT ON public.conversations
    FOR EACH ROW
    WHEN (NEW.role = 'user')
    EXECUTE FUNCTION update_conversation_summary();

-- Add unique constraint to prevent duplicate user_id in summaries
ALTER TABLE public.conversation_summaries 
ADD CONSTRAINT unique_user_summary UNIQUE (user_id);