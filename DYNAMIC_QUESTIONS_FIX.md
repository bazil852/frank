# Fix: Dynamic Group 1 Questions (No More Repetition)

## Problem
When users provided SOME Group 1 fields (e.g., industry + years), Frank would repeat ALL 4 questions again instead of just asking for the missing ones.

**Example of the bug:**
```
User: "I'm in manufacturing and been trading for 10 years"
Profile: {industry: "Manufacturing", yearsTrading: 10}

Frank: "Tell me about your business:
• What industry are you in?  ❌ Already have this!
• How long have you been trading?  ❌ Already have this!
• What's your monthly turnover?  ✅ Need this
• How much funding do you need?"  ✅ Need this
```

## Root Cause

The old logic used **OR** condition:
```typescript
if (miss('industry') || miss('monthlyTurnover') || miss('yearsTrading') || miss('amountRequested')) {
  return `Ask ALL 4 questions`; // Always asks everything
}
```

This meant if ANY field was missing, it would ask for ALL fields again, ignoring what the user already provided.

## The Fix

**File:** [lib/flow.ts:19-58](lib/flow.ts#L19-L58)

Implemented **dynamic question building** that:
1. Checks which Group 1 fields are missing
2. Builds questions only for missing fields
3. Uses different intros based on how many fields are missing

```typescript
// Check what's missing
const group1Missing = [];
if (miss('industry')) group1Missing.push('industry');
if (miss('yearsTrading')) group1Missing.push('yearsTrading');
if (miss('monthlyTurnover')) group1Missing.push('monthlyTurnover');
if (miss('amountRequested')) group1Missing.push('amountRequested');

if (group1Missing.length > 0) {
  // Build questions only for missing fields
  const questions = [];
  if (group1Missing.includes('industry')) questions.push('• What industry are you in?');
  if (group1Missing.includes('yearsTrading')) questions.push('• How long have you been trading?');
  if (group1Missing.includes('monthlyTurnover')) questions.push('• What\'s your monthly turnover?');
  if (group1Missing.includes('amountRequested')) questions.push('• How much funding do you need?');

  // Choose intro based on how many fields missing
  if (group1Missing.length >= 3) {
    return `Tell me about your business:\n${questions.join('\n')}`;
  } else {
    return `Just need a bit more info:\n${questions.join('\n')}`;
  }
}
```

## New Behavior

### Scenario 1: No fields provided (4 missing)
```
User: "Hey"
Profile: {}

Frank: "Tell me about your business:
• What industry are you in?
• How long have you been trading?
• What's your monthly turnover?
• How much funding do you need?"
```
✅ Uses full intro ("Tell me about your business")

### Scenario 2: Partial info provided (2 missing)
```
User: "I'm in manufacturing and been trading for 10 years"
Profile: {industry: "Manufacturing", yearsTrading: 10}

Frank: "Just need a bit more info:
• What's your monthly turnover?
• How much funding do you need?"
```
✅ Only asks for missing fields
✅ Uses shorter intro ("Just need a bit more info")

### Scenario 3: Almost complete (1 missing)
```
User: "Restaurant, 2 years, R150k/month"
Profile: {industry: "Restaurant", yearsTrading: 2, monthlyTurnover: 150000}

Frank: "Just need a bit more info:
• How much funding do you need?"
```
✅ Only asks for the one missing field

### Scenario 4: All Group 1 fields provided
```
User: "Restaurant, 2 years, R150k/month, need R500k"
Profile: {industry: "Restaurant", yearsTrading: 2, monthlyTurnover: 150000, amountRequested: 500000}

Frank: "Is your business registered in South Africa, and do you have at least one SA director?"
```
✅ Moves to Group 2 immediately

## Benefits

✅ **No repetition** - Never asks for information already provided
✅ **Context-aware** - Questions adapt to what's missing
✅ **Better UX** - Users feel heard, not ignored
✅ **Efficient** - Gets to matching faster
✅ **Progressive** - Natural conversation flow

## Edge Cases Handled

1. **User provides fields out of order** - Works fine, only asks for missing ones
2. **User provides all 4 at once** - Skips Group 1, goes to Group 2
3. **User provides 1 field at a time** - Each response asks for remaining fields
4. **User provides conflicting info** - Latest extraction overwrites previous

## Testing

Test these scenarios:
- [ ] "Hey" → Shows all 4 questions
- [ ] "I'm in retail" → Shows 3 questions (missing years, turnover, amount)
- [ ] "Retail, 5 years" → Shows 2 questions (missing turnover, amount)
- [ ] "Retail, 5 years, R200k/month" → Shows 1 question (missing amount)
- [ ] "Retail, 5 years, R200k/month, need R1M" → Moves to Group 2
