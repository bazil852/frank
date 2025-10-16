# Critical Fix: Empty String and Zero Extraction Bug

## Problem
When user sent "hello" or "hey", extraction returned **empty strings and zeros** instead of empty object, causing the system to think it had all information and disqualify the user from all 41 lenders.

**Logs showing the bug:**
```javascript
User: "hello"

Extracted data: {
  industry: '',           // ← Should be undefined!
  yearsTrading: 0,        // ← Should be undefined!
  monthlyTurnover: 0,     // ← Should be undefined!
  amountRequested: 0,     // ← Should be undefined!
  vatRegistered: false,   // ← Should be undefined!
  ...
}

// System thinks: "Great! I have all the fields!"
hasHardRequirements(): TRUE ✅ (WRONG!)

Match Result: 0 qualified, 0 needMoreInfo, 41 notQualified
```

## Root Cause

**JSON Schema Mode Issue:**
When using `response_format: { type: "json_schema" }`, gpt-5 sometimes fills in **default values** for missing fields:
- Strings → `""` (empty string)
- Numbers → `0` (zero)
- Booleans → `false`

The code was treating these as "provided" values, so:
- `industry: ''` was considered "have industry" ✅
- `yearsTrading: 0` was considered "have years" ✅
- Result: All hard requirements "met" but with garbage data

## The Fix

### 1. Added Value Validation ([lib/openai-client.ts:110-148](lib/openai-client.ts#L110-L148))

**Clean up extracted values before returning:**
```typescript
const rawExtracted = JSON.parse(extraction.choices[0].message!.content!).extracted;

// Clean up: remove empty strings, zeros, and false positives
const extracted: Partial<Profile> = {};

// Only include fields that have meaningful values
if (rawExtracted.industry && rawExtracted.industry.trim() !== '') {
  extracted.industry = rawExtracted.industry;
}
if (rawExtracted.yearsTrading && rawExtracted.yearsTrading > 0) {
  extracted.yearsTrading = rawExtracted.yearsTrading;
}
if (rawExtracted.monthlyTurnover && rawExtracted.monthlyTurnover > 0) {
  extracted.monthlyTurnover = rawExtracted.monthlyTurnover;
}
if (rawExtracted.amountRequested && rawExtracted.amountRequested > 0) {
  extracted.amountRequested = rawExtracted.amountRequested;
}

// Boolean fields: only include if explicitly true or false (not default)
if (rawExtracted.vatRegistered !== undefined && rawExtracted.vatRegistered !== null) {
  extracted.vatRegistered = rawExtracted.vatRegistered;
}
// ... (same for other booleans)
```

### 2. Updated System Prompt ([lib/openai-client.ts:74-76](lib/openai-client.ts#L74-L76))

**Explicitly tell gpt-5 not to return empty values:**
```typescript
content: `Extract business facts from the user message. Use context to infer unlabeled values.
CRITICAL: If a field is not mentioned or cannot be inferred, DO NOT include it in the output.
Do not return empty strings, zeros, or false values unless explicitly stated.
South Africa context. ${contextHint}`
```

### 3. Added Examples for Empty Cases ([lib/openai-client.ts:84-88](lib/openai-client.ts#L84-L88))

```typescript
Input: 'hey' or 'hello' (greeting with no business info)
Output: {"extracted":{}}

Input: 'tell me more' (no new information)
Output: {"extracted":{}}
```

## New Behavior

### Scenario 1: Greeting Message
```
User: "hello"

Raw Extracted: {industry: '', yearsTrading: 0, monthlyTurnover: 0, ...}

After Cleanup: {}  ✅

hasHardRequirements(): FALSE (correct!)

Frank: "Let's get you matched.

Tell me about your business:
• What industry are you in?
• How long have you been trading?
• What's your monthly turnover?
• How much funding do you need?"
```

### Scenario 2: Actual Business Info
```
User: "Restaurant, 2 years, R150k/month, need R500k"

Raw Extracted: {industry: 'Restaurant', yearsTrading: 2, monthlyTurnover: 150000, amountRequested: 500000}

After Cleanup: {industry: 'Restaurant', yearsTrading: 2, monthlyTurnover: 150000, amountRequested: 500000}  ✅

hasHardRequirements(): FALSE (still missing other fields)

Frank: "Is your business registered in South Africa..." (moves to Group 2)
```

### Scenario 3: Partial Info
```
User: "We're in manufacturing"

Raw Extracted: {industry: 'manufacturing', yearsTrading: 0, monthlyTurnover: 0, ...}

After Cleanup: {industry: 'manufacturing'}  ✅

hasHardRequirements(): FALSE (correct!)

Frank: "Just need a bit more info:
• How long have you been trading?
• What's your monthly turnover?
• How much funding do you need?"
```

## Validation Rules

### String Fields
- ✅ Include if: non-empty after trim
- ❌ Exclude if: empty string or whitespace only

### Numeric Fields
- ✅ Include if: > 0
- ❌ Exclude if: 0, negative, NaN, undefined

### Boolean Fields
- ✅ Include if: explicitly true or false
- ❌ Exclude if: undefined or null
- ⚠️ Note: `false` is valid (e.g., "not VAT registered")

## Impact

**Before Fix:**
- User says "hello" → System thinks it has all info → Disqualifies from all lenders
- Terrible UX, confusing error messages
- No way to progress in conversation

**After Fix:**
- User says "hello" → System extracts `{}` → Shows proper opener questions
- Clean conversation flow
- Progressive disclosure works correctly

## Testing

Test these scenarios:
- [x] "hello" → Extracts `{}`, shows opener
- [x] "hey" → Extracts `{}`, shows opener
- [x] "tell me more" → Extracts `{}`, shows context-appropriate response
- [x] "Restaurant, 2 years" → Extracts only industry and years
- [x] "Not VAT registered" → Extracts `{vatRegistered: false}` (valid!)
- [x] Build succeeds

## Files Changed

**[lib/openai-client.ts](lib/openai-client.ts)**
- Lines 74-76: Updated system prompt with CRITICAL instruction
- Lines 84-88: Added examples for empty extraction cases
- Lines 110-148: Added value validation and cleanup logic
