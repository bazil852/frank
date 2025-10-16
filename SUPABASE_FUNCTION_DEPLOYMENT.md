# Supabase Edge Function Deployment Guide

## Why Supabase Edge Functions?

**Problem**: Netlify serverless functions have a 10-second timeout (free tier) or 26-second timeout (paid tier), which isn't enough for AI operations with multiple tool calling iterations.

**Solution**: Supabase Edge Functions have a **150-second timeout**, perfect for AI conversations with multiple iterations.

## Prerequisites

1. Install Supabase CLI:
```bash
brew install supabase/tap/supabase
# or
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

## Deployment Steps

### 1. Link Your Project

```bash
cd /Users/bazil/Documents/frank
supabase link --project-ref YOUR_PROJECT_REF
```

Get your project ref from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/general

### 2. Set Environment Variables

Set secrets for your Supabase function:

```bash
# OpenAI API Key (required)
supabase secrets set OPENAI_API_KEY=sk-proj-...

# Supabase credentials (automatically available in Edge Functions)
supabase secrets set SUPABASE_URL=https://wpwnhkqpwffcjgwjqjen.supabase.co
supabase secrets set SUPABASE_ANON_KEY=eyJ...

# Optional: Model configuration
supabase secrets set OPENAI_MODEL=gpt-5
```

### 3. Deploy the Function

```bash
supabase functions deploy chat-tools
```

This will deploy the function at:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/chat-tools
```

### 4. Verify Deployment

Test the function:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/chat-tools \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \\
  -d '{
    "message": "construction, 5 years trading, 100k turnover, 1 million needed",
    "chatHistory": [],
    "userId": "test-user-123",
    "sessionId": "test-session-123"
  }'
```

### 5. Update Frontend (Already Done)

The frontend in `app/page.tsx` automatically uses the Supabase function if `NEXT_PUBLIC_SUPABASE_URL` is set, with fallback to Netlify.

## Environment Variables Summary

### Supabase Secrets (set via CLI)
```bash
OPENAI_API_KEY=sk-proj-...
SUPABASE_URL=https://wpwnhkqpwffcjgwjqjen.supabase.co
SUPABASE_ANON_KEY=eyJ...
OPENAI_MODEL=gpt-5  # optional
```

### Frontend Environment Variables (Netlify)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://wpwnhkqpwffcjgwjqjen.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## Function Features

✅ **150-second timeout** - No more 504 errors
✅ **Tool calling loop** - Handles multiple iterations
✅ **CORS support** - Works from any domain
✅ **Direct Supabase access** - Fast database operations
✅ **Proper error handling** - Detailed logging
✅ **Markdown formatting** - Beautiful AI responses

## Monitoring

View function logs in Supabase Dashboard:
1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT
2. Click "Edge Functions" in sidebar
3. Click on "chat-tools" function
4. View logs and invocations

## Debugging

If the function isn't working:

1. **Check logs**:
```bash
supabase functions logs chat-tools
```

2. **Verify secrets**:
```bash
supabase secrets list
```

3. **Test locally** (optional):
```bash
supabase functions serve chat-tools --env-file .env.local
```

## Cost

Supabase Edge Functions pricing:
- **Free tier**: 500,000 invocations/month
- **Pro tier**: 2 million invocations/month
- After that: $2 per 1 million invocations

Much cheaper than Netlify Functions at scale!

## Rollback

If you need to rollback to Netlify functions:
1. The frontend has automatic fallback
2. Just remove `NEXT_PUBLIC_SUPABASE_URL` from Netlify env vars
3. It will use `/api/chat-tools` (Netlify) instead

## Next Steps

1. Deploy the function to Supabase
2. Set environment variables
3. Test with the curl command above
4. Frontend will automatically use Supabase function
5. Enjoy 150-second timeout! 🎉
