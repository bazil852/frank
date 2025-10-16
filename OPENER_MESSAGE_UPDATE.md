# Update: Improved Opener Message with Industry Question

## Change Summary
Updated the first opener message to ask for **industry** along with the other core business metrics, making it more conversational and complete.

## What Changed

### Before
```
Let's get you matched.

I need three quick stats:
• Monthly turnover (e.g., R100k/month)
• Years trading (most lenders want 6–12 months)
• Funding amount required

• Share those now
• Ask what lenders usually look for
```

**Problems:**
- Didn't ask for industry (needed for sector exclusions matching)
- Sounded transactional ("I need three quick stats")
- Missing a key piece of information from the start

### After
```
Let's get you matched.

Tell me about your business:
• What industry are you in?
• How long have you been trading?
• What's your monthly turnover?
• How much funding do you need?

• Share those now
• Ask what lenders usually look for
```

**Improvements:**
✅ More conversational ("Tell me about your business")
✅ Asks for industry upfront (needed for matching)
✅ Questions flow more naturally
✅ Collects all Group 1 requirements in one go

## Files Changed

### 1. [lib/flow.ts:22-28](lib/flow.ts#L22-L28)
**Updated `nextQuestionGroup()` Group 1:**
- Added `industry` to the missing fields check
- Updated question text to be more conversational

```typescript
if (miss('industry') || miss('monthlyTurnover') || miss('yearsTrading') || miss('amountRequested')) return (
`Tell me about your business:
• What industry are you in?
• How long have you been trading?
• What's your monthly turnover?
• How much funding do you need?`
);
```

### 2. [lib/flow.ts:5-16](lib/flow.ts#L5-L16)
**Updated `hasHardRequirements()`:**
- Added `industry` to the required fields check
- Now requires 9 fields instead of 8

```typescript
export function hasHardRequirements(p: Partial<Profile>) {
  return (
    have(p,'industry') &&           // ← ADDED
    have(p,'monthlyTurnover') &&
    have(p,'yearsTrading') &&
    have(p,'amountRequested') &&
    have(p,'saRegistered') &&
    have(p,'saDirector') &&
    have(p,'bankStatements') &&
    have(p,'province') &&
    have(p,'vatRegistered')
  );
}
```

### 3. [lib/requirements.ts:14-20](lib/requirements.ts#L14-L20)
**Updated `OPENING_SMALL_GROUP` constant:**
- Changed to match the new question format

### 4. [lib/openai-client.ts:67-84](lib/openai-client.ts#L67-L84)
**Updated extraction examples:**
- Added examples that include industry extraction
- Shows gpt-5 how to extract industry from various phrasings

```typescript
Input: 'I run a restaurant, been trading 2 years, make 300k a month, need 1.2m'
Output: {"extracted":{"industry":"Restaurant","yearsTrading":2,"monthlyTurnover":300000,"amountRequested":1200000}}

Input: 'Construction business, 18 months old, R150k monthly turnover, need R500k'
Output: {"extracted":{"industry":"Construction","yearsTrading":1.5,"monthlyTurnover":150000,"amountRequested":500000}}
```

## Why This Matters

### Business Logic
Industry is used in [lib/filters.ts:204-206](lib/filters.ts#L204-L206) for sector exclusions:
```typescript
if (hasBasics && product.sectorExclusions && profile.industry && product.sectorExclusions.includes(profile.industry)) {
  reasons.push(`${profile.industry} sector excluded`);
}
```

Without asking for industry upfront, the matching can't properly filter out lenders that exclude certain sectors.

### User Experience
- **More natural conversation** - "Tell me about your business" is friendlier than "I need stats"
- **Complete picture** - Gets all core information in the first interaction
- **Better matching** - Industry allows immediate sector exclusion filtering

## Updated Conversation Flow

**Turn 1:**
```
User: "hey"
Frank: "Let's get you matched.

Tell me about your business:
• What industry are you in?
• How long have you been trading?
• What's your monthly turnover?
• How much funding do you need?

• Share those now
• Ask what lenders usually look for"
```

**Turn 2:**
```
User: "I run a restaurant, been trading 2 years, make R150k/month, need R500k"
Frank: [Extracts: industry=Restaurant, yearsTrading=2, monthlyTurnover=150000, amountRequested=500000]
Frank: "Is your business registered in South Africa, and do you have at least one SA director?"
```

**Turn 3+:** Continues through Groups 2-5 until all hard requirements collected.

## Testing Checklist

- [x] First message shows updated opener with industry question
- [x] Industry is extracted when user provides it
- [x] hasHardRequirements() now requires industry field
- [x] Matching properly uses industry for sector exclusions
- [x] Build succeeds without errors
