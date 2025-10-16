# Fix: "Got it — I'll tune your matches" Repetition Issue

## Problem
Frank kept saying `"Got it — I'll tune your matches based on your needs"` instead of the actual AI-generated responses.

## Root Cause Analysis

### The Deduplication System
[lib/ai-schemas.ts:82-92](lib/ai-schemas.ts#L82-L92) has a `dedupeLines()` function that:
1. Splits responses into lines
2. Filters out any lines that were used in previous responses
3. Stores seen lines in a Set to prevent repetition

**The Bug:**
- When ALL lines in a response were seen before → returns **empty string** `""`
- Empty string triggers fallback text in [app/page.tsx:291,299](app/page.tsx#L291)
- Fallback: `'Got it — I\'ll tune your matches based on your needs'`

### Why It Happened
The early conversation flow uses **structured templates** like:
```
Let's get you matched.

I need three quick stats:
• Monthly turnover
• Years trading
• Funding amount

• Share those now
• Ask what lenders usually look for
```

These templates were being passed through `dedupeLines()`, causing:
- First time: Shows correctly
- Second time user sends "hey" or similar: ALL lines filtered → empty response → fallback text

## Fixes Applied

### Fix 1: Prevent Empty Deduped Responses
**File:** [lib/ai-schemas.ts:89-91](lib/ai-schemas.ts#L89-L91)

```typescript
// If everything was filtered out, return original text to avoid empty responses
const result = fresh.join('\n');
return result.trim() || text;
```

**Why:** Ensures `dedupeLines()` never returns empty string - falls back to original text.

### Fix 2: Skip Deduping for Structured Questions
**File:** [lib/openai-client.ts:120-121](lib/openai-client.ts#L120-L121)

```typescript
// Don't dedupe the early question flow - these are structured questions that should always show
return forced;
```

**Why:** The progressive question groups (Group 1-5) are **intentional structured questions** that should always display completely, not be deduplicated.

## Testing

**Before Fix:**
```
User: "hey"
Frank: "Let's get you matched. I need three quick stats..."

User: "hey" (again)
Frank: "Got it — I'll tune your matches based on your needs"  ❌ (empty after deduping)
```

**After Fix:**
```
User: "hey"
Frank: "Let's get you matched. I need three quick stats..."

User: "hey" (again)
Frank: "Let's get you matched. I need three quick stats..."  ✅ (structured question always shows)

User: "Need R500k for my restaurant"
Frank: [AI-generated response about restaurant funding]  ✅ (actual AI response)

User: "Tell me more"
Frank: [AI-generated response]  ✅ (if all lines seen before, returns original instead of empty)
```

## Related Changes

This fix complements the earlier conversation flow fixes:
1. **Progressive Disclosure** - Fixed in [lib/openai-client.ts:109-122](lib/openai-client.ts#L109-L122)
2. **Hard Requirements Flow** - Fixed in [lib/flow.ts:18-42](lib/flow.ts#L18-L42)
3. **Extraction Examples** - Updated in [lib/openai-client.ts:67-81](lib/openai-client.ts#L67-81)

Together these ensure:
- Frank asks the right questions at the right time
- Questions always display properly
- AI responses don't get filtered out
- Matching works with all new hard requirements
