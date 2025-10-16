# Fix: Context-Aware Extraction (Understands "100k and 1 million")

## Problem
When users provided unlabeled numbers like "100k and 1 million" in response to Frank's questions, the extraction failed and returned `{}`, causing Frank to repeat the same questions.

**Example of the bug:**
```
Frank: "Just need a bit more info:
• What's your monthly turnover?
• How much funding do you need?"

User: "100k and 1 million"

Extracted: {}  ❌ Didn't understand the context!

Frank: "Just need a bit more info:
• What's your monthly turnover?  ← Repeats!
• How much funding do you need?"
```

## Root Cause

The extraction function had **zero context** about:
- What the current profile contains
- What fields are still missing
- What Frank just asked for

So when users answered with unlabeled values, gpt-5 couldn't infer what they meant.

## The Fix

**File:** [lib/openai-client.ts:54-108](lib/openai-client.ts#L54-L108)

### 1. Added Profile Parameter
```typescript
private static async extractBusinessInfo(
  message: string,
  currentProfile: Partial<Profile> = {}  // ← NEW: Pass current profile
): Promise<Partial<Profile>>
```

### 2. Build Context Hint
```typescript
// Build context about what we're still missing
const missingFields = [];
if (!currentProfile.industry) missingFields.push('industry');
if (!currentProfile.yearsTrading) missingFields.push('years trading');
if (!currentProfile.monthlyTurnover) missingFields.push('monthly turnover');
if (!currentProfile.amountRequested) missingFields.push('funding amount');

const contextHint = missingFields.length > 0
  ? `Currently missing: ${missingFields.join(', ')}. If user provides numbers without labels, infer based on what's missing.`
  : '';
```

### 3. Enhanced System Prompt
```typescript
{
  role: "system",
  content: `Extract business facts from the user message. Use context to infer unlabeled values. South Africa context. ${contextHint}`
}
```

### 4. Added Context Examples
```typescript
Input (when missing turnover and amount): '100k and 1 million'
Output: {"extracted":{"monthlyTurnover":100000,"amountRequested":1000000}}

Input (when missing amount): '500k'
Output: {"extracted":{"amountRequested":500000}}

Current profile: ${JSON.stringify(currentProfile)}
```

### 5. Updated Function Call
```typescript
// Pass profile for context
const newExtracted = await this.extractBusinessInfo(message, profile);
```

## New Behavior

### Scenario 1: Unlabeled Numbers
```
Profile: {industry: "Manufacturing", yearsTrading: 10}
Missing: monthlyTurnover, amountRequested

User: "100k and 1 million"

Context Hint: "Currently missing: monthly turnover, funding amount"

Extracted: {monthlyTurnover: 100000, amountRequested: 1000000}  ✅
```

### Scenario 2: Single Unlabeled Number
```
Profile: {industry: "Retail", yearsTrading: 5, monthlyTurnover: 200000}
Missing: amountRequested

User: "Need 500k"

Context Hint: "Currently missing: funding amount"

Extracted: {amountRequested: 500000}  ✅
```

### Scenario 3: Partial Context
```
Profile: {industry: "Construction"}
Missing: yearsTrading, monthlyTurnover, amountRequested

User: "2 years, 150k monthly"

Context Hint: "Currently missing: years trading, monthly turnover, funding amount"

Extracted: {yearsTrading: 2, monthlyTurnover: 150000}  ✅
```

### Scenario 4: Clear Labels (Always Works)
```
Profile: {}
Missing: everything

User: "Restaurant, 2 years, R150k/month, need R500k"

Extracted: {
  industry: "Restaurant",
  yearsTrading: 2,
  monthlyTurnover: 150000,
  amountRequested: 500000
}  ✅
```

## Benefits

✅ **Understands context** - Knows what's missing and infers accordingly
✅ **No repetition** - Successfully extracts unlabeled values
✅ **Natural conversation** - Users can answer casually ("100k and 1m")
✅ **Flexible** - Works with labeled or unlabeled values
✅ **Smarter** - Uses current profile state to guide extraction

## Testing

Test these scenarios:
- [x] "100k and 1 million" (when missing both) → Extracts correctly
- [x] "500k" (when only missing amount) → Extracts as amountRequested
- [x] "2 years, 150k" (when missing years and turnover) → Extracts both
- [x] Full labeled sentence → Still works as before
- [x] No numbers → Returns {} without breaking

## Why It Was Repeating

**Before:**
1. User: "100k and 1 million"
2. Extraction (no context): `{}` ← Failed!
3. Profile still missing fields → Frank asks same questions
4. Repeat forever

**After:**
1. User: "100k and 1 million"
2. Extraction (with context): `{monthlyTurnover: 100000, amountRequested: 1000000}` ✅
3. Profile now complete for Group 1 → Frank moves to Group 2
4. Progress!
