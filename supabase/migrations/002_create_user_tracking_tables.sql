-- Create anonymous users table
CREATE TABLE IF NOT EXISTS public.anonymous_users (
    user_id TEXT PRIMARY KEY,
    device_fingerprint TEXT,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    total_sessions INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS public.user_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.anonymous_users(user_id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    page_views INTEGER DEFAULT 0,
    device_info JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create events tracking table
CREATE TABLE IF NOT EXISTS public.user_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.anonymous_users(user_id),
    session_id TEXT REFERENCES public.user_sessions(session_id),
    event_name TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    page_url TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create applications tracking table (for loan applications)
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.anonymous_users(user_id),
    session_id TEXT REFERENCES public.user_sessions(session_id),
    lender_id UUID REFERENCES public.lenders(id),
    profile_data JSONB NOT NULL,
    contact_info JSONB NOT NULL,
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'viewed', 'contacted', 'approved', 'rejected')),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_anonymous_users_fingerprint ON public.anonymous_users(device_fingerprint);
CREATE INDEX idx_anonymous_users_last_seen ON public.anonymous_users(last_seen DESC);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_events_user_id ON public.user_events(user_id);
CREATE INDEX idx_user_events_session_id ON public.user_events(session_id);
CREATE INDEX idx_user_events_timestamp ON public.user_events(timestamp DESC);
CREATE INDEX idx_applications_user_id ON public.applications(user_id);
CREATE INDEX idx_applications_status ON public.applications(status);

-- Disable RLS for all tracking tables (as requested - no auth required)
ALTER TABLE public.anonymous_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications DISABLE ROW LEVEL SECURITY;

-- Function to update last_seen for users
CREATE OR REPLACE FUNCTION update_user_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.anonymous_users 
    SET last_seen = NOW() 
    WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_seen when new events are created
CREATE TRIGGER update_last_seen_on_event
    AFTER INSERT ON public.user_events
    FOR EACH ROW
    EXECUTE FUNCTION update_user_last_seen();

-- Function to calculate session duration
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
        NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to calculate duration when session ends
CREATE TRIGGER calculate_duration_on_session_end
    BEFORE UPDATE ON public.user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION calculate_session_duration();