# Complete Fix Summary - Frank Conversation Flow

## Issues Fixed

### 1. ❌ No Matching (All Lenders in "Need More Info")
**Problem:** All 41 lenders showing in `needMoreInfo`, 0 qualified
**Cause:** New hard requirements added but conversation flow never asked for them
**Fix:** [lib/openai-client.ts](lib/openai-client.ts), [lib/flow.ts](lib/flow.ts) - Progressive disclosure through 5 question groups

### 2. ❌ Repetitive Fallback ("Got it — I'll tune your matches")
**Problem:** Frank kept saying the same fallback text instead of actual responses
**Cause:** `dedupeLines()` was filtering out all lines, returning empty string
**Fix:** [lib/ai-schemas.ts:82-92](lib/ai-schemas.ts#L82-L92) - Return original text if everything filtered

### 3. ❌ First Opener Message Not Showing
**Problem:** Initial greeting message wasn't displaying
**Cause:** First API call response was discarded, second call used instead
**Fix:** [app/page.tsx:215-249](app/page.tsx#L215-L249) - Use first response, only regenerate if data extracted

### 4. ❌ Missing Industry Question
**Problem:** Opener didn't ask for industry (needed for sector exclusions)
**Cause:** Initial design oversight
**Fix:** [lib/flow.ts:22-43](lib/flow.ts#L22-L43) - Added industry to Group 1 questions

### 5. ❌ Repeating All Questions
**Problem:** Frank repeated ALL Group 1 questions even if some were answered
**Cause:** Used OR logic - if ANY field missing, ask ALL questions
**Fix:** [lib/flow.ts:19-58](lib/flow.ts#L19-L58) - Dynamic question building (only ask what's missing)

### 6. ❌ Context-Blind Extraction
**Problem:** Failed to extract "100k and 1 million" (unlabeled numbers)
**Cause:** Extraction had no context about what fields were missing
**Fix:** [lib/openai-client.ts:54-108](lib/openai-client.ts#L54-L108) - Pass current profile for context-aware extraction

## New Conversation Flow

### Turn 1: Initial Contact
```
User: "hey"
Profile: {}

Frank: "Let's get you matched.

Tell me about your business:
• What industry are you in?
• How long have you been trading?
• What's your monthly turnover?
• How much funding do you need?

• Share those now
• Ask what lenders usually look for"
```

### Turn 2: Partial Info Provided
```
User: "Manufacturing, 10 years"
Profile: {industry: "Manufacturing", yearsTrading: 10}

Frank: "Just need a bit more info:
• What's your monthly turnover?
• How much funding do you need?"
```
✅ Only asks for missing fields (dynamic questions)

### Turn 3: Unlabeled Numbers
```
User: "100k and 1 million"
Profile: {industry: "Manufacturing", yearsTrading: 10, monthlyTurnover: 100000, amountRequested: 1000000}

Frank: "Is your business registered in South Africa, and do you have at least one SA director?"
```
✅ Context-aware extraction works
✅ Moves to Group 2

### Turn 4: SA Registration
```
User: "Yes, registered with SA director"
Profile: {..., saRegistered: true, saDirector: true}

Frank: "Do you have 6+ months of bank statements available?"
```
✅ Group 3

### Turn 5: Bank Statements
```
User: "Yes"
Profile: {..., bankStatements: true}

Frank: "Which province are you based in, and are you VAT registered?"
```
✅ Group 4

### Turn 6: Location + VAT
```
User: "Gauteng, not VAT registered"
Profile: {..., province: "Gauteng", vatRegistered: false}

Frank: [Shows qualified matches with AI-generated response]
```
✅ All 9 hard requirements collected
✅ Matching activates
✅ Shows qualified lenders!

## Required Hard Fields (9 Total)

**Group 1: Business Basics**
1. `industry` - For sector exclusion filtering
2. `yearsTrading` - Minimum trading history requirement
3. `monthlyTurnover` - Minimum turnover requirement
4. `amountRequested` - Amount range matching

**Group 2: SA Requirements**
5. `saRegistered` - Must be SA registered business
6. `saDirector` - SA director requirement (varies by lender)

**Group 3: Documentation**
7. `bankStatements` - 6+ months bank statements

**Group 4: Location & Tax**
8. `province` - Provincial restrictions
9. `vatRegistered` - VAT requirements (varies by lender)

## Key Improvements

✅ **Progressive Disclosure** - Asks for info in logical groups
✅ **Context-Aware** - Understands unlabeled values based on what's missing
✅ **Dynamic Questions** - Only asks for missing fields, not everything
✅ **No Repetition** - Tracks what's been asked and answered
✅ **Smart Extraction** - Uses profile context to infer values
✅ **Proper Matching** - All hard requirements collected before qualifying lenders

## Files Changed

1. **[lib/openai-client.ts](lib/openai-client.ts)** - Context-aware extraction, fixed early exit
2. **[lib/flow.ts](lib/flow.ts)** - Dynamic questions, hasHardRequirements with industry
3. **[lib/ai-schemas.ts](lib/ai-schemas.ts)** - Fixed dedupeLines fallback
4. **[app/page.tsx](app/page.tsx)** - Use first response, only regenerate if data extracted
5. **[lib/requirements.ts](lib/requirements.ts)** - Updated opener text
6. **[lib/chunker.ts](lib/chunker.ts)** - Fixed import path

## Testing Checklist

- [x] First "hey" → Shows full opener with 4 questions
- [x] Partial answer → Shows only missing fields
- [x] Unlabeled numbers → Extracts correctly with context
- [x] All Group 1 complete → Moves to Group 2
- [x] All groups complete → Shows qualified matches
- [x] No more "tune your matches" fallback
- [x] No repetition of already-answered questions
- [x] Build succeeds without errors

## Performance Impact

- **API Calls Reduced**: Only regenerates response when data changes
- **Better UX**: Faster conversation, feels more natural
- **Smarter Extraction**: Higher success rate on casual responses
- **Clear Progress**: Users see they're making progress through groups
