# Fix: First Opener Message Not Showing

## Problem
When a user sends their first message (e.g., "hey"), Frank's opener response wasn't being displayed. Instead, users would see either no response or the fallback text.

## Root Cause

The page component at [app/page.tsx:206-310](app/page.tsx#L206-L310) was calling `FrankAI.chat()` **twice**:

1. **First Call (Line 216)**: Extract data and generate response
   - Called with empty profile: `FrankAI.chat(message, chatHistory, profile={}, products, undefined)`
   - `generateResponse()` correctly returns the opener: `"Let's get you matched.\n\nI need three quick stats..."`
   - **BUT**: This response was stored in `extractionResult.summary` and **never used!**

2. **Second Call (Line 243)**: Generate response again with updated profile
   - If nothing was extracted, `updatedProfile === profile` (still empty)
   - Generates the same opener again
   - This response was used and displayed

**The Issue:**
- The code was **throwing away the first response** and regenerating the same thing
- This caused:
  - Wasted API calls (2x gpt-5 calls for the same result)
  - Potential timing issues where the second call might fail or return something different
  - The first message sometimes not showing due to race conditions

## The Fix

**File:** [app/page.tsx:215-249](app/page.tsx#L215-L249)

Changed the logic to:

1. **Use the first response by default**
   ```typescript
   let responseToUse = extractionResult.summary; // Use the first response
   ```

2. **Only regenerate if data was extracted**
   ```typescript
   if (extractionResult.extracted && Object.keys(extractionResult.extracted).length > 0) {
     // Update profile and matches
     // ...

     // Generate fresh response with updated profile
     const responseResult = await FrankAI.chat(message, chatHistory, updatedProfile, products, currentMatches);
     responseToUse = responseResult.summary; // Override with updated response
   }
   ```

3. **Return the appropriate response**
   ```typescript
   const responseResult = { summary: responseToUse, extracted: extractionResult.extracted };
   ```

## Benefits

✅ **First message always shows** - The initial opener is now used and displayed
✅ **Reduced API calls** - Only calls gpt-5 twice when data is actually extracted
✅ **More efficient** - Doesn't waste API calls regenerating the same response
✅ **No race conditions** - Uses the first response that was already generated

## Expected Behavior

### Scenario 1: First Message (No Extraction)
```
User: "hey"
Frank: "Let's get you matched.

I need three quick stats:
• Monthly turnover (e.g., R100k/month)
• Years trading (most lenders want 6–12 months)
• Funding amount required

• Share those now
• Ask what lenders usually look for"
```
- ✅ Only 1 call to `FrankAI.chat()`
- ✅ Opener displays immediately

### Scenario 2: First Message with Data
```
User: "I need R500k, been trading 2 years, make R150k/month"
Frank: [Contextual response based on extracted data]
```
- 2 calls to `FrankAI.chat()`:
  1. Extract data → gets opener
  2. Generate response with data → gets contextual response
- ✅ Uses the second (contextual) response

### Scenario 3: Follow-up Message (No New Data)
```
User: "tell me more"
Frank: [AI-generated response using current profile]
```
- ✅ Only 1 call (first response is used)

## Testing Checklist

- [x] First message "hey" → Shows opener
- [x] First message with data → Shows contextual response
- [x] Follow-up messages → Show appropriate responses
- [x] Build succeeds without errors
- [x] No duplicate API calls when no data extracted
