# Frank Conversation Flow - Test Scenarios

## Expected Flow with New Hard Requirements

### Scenario 1: Complete Flow (All Questions Answered)

**Turn 1:**
- User: "hey"
- Profile: `{}`
- `hasHardRequirements()`: false
- `nextQuestionGroup()`: Group 1 (basics)
- Frank asks: "I need three quick stats: Monthly turnover, Years trading, Funding amount"
- Match Results: 0 qualified, 41 needMoreInfo (all missing "Need core business information first")

**Turn 2:**
- User: "We do R150k a month, been trading 18 months, need R500k"
- Profile: `{monthlyTurnover: 150000, yearsTrading: 1.5, amountRequested: 500000}`
- `hasHardRequirements()`: false (missing saRegistered, saDirector, bankStatements, province, vatRegistered)
- `nextQuestionGroup()`: Group 2 (SA registration)
- Frank asks: "Is your business registered in South Africa, and do you have at least one SA director?"
- Match Results: Still 0 qualified (missing saRegistered, saDirector, bankStatements)

**Turn 3:**
- User: "Yes, registered in SA with SA director"
- Profile: `{..., saRegistered: true, saDirector: true}`
- `hasHardRequirements()`: false (missing bankStatements, province, vatRegistered)
- `nextQuestionGroup()`: Group 3 (bank statements)
- Frank asks: "Do you have 6+ months of bank statements available?"
- Match Results: Still 0 qualified (missing bankStatements)

**Turn 4:**
- User: "Yes, we have bank statements"
- Profile: `{..., bankStatements: true}`
- `hasHardRequirements()`: false (missing province, vatRegistered)
- `nextQuestionGroup()`: Group 4 (location + VAT)
- Frank asks: "Which province are you based in, and are you VAT registered?"
- Match Results: Still 0 qualified (missing province, vatRegistered)

**Turn 5:**
- User: "Gauteng, not VAT registered"
- Profile: `{..., province: "Gauteng", vatRegistered: false}`
- `hasHardRequirements()`: **TRUE** ✅
- `nextQuestionGroup()`: null (all hard requirements collected!)
- Frank: Generates AI response with qualified matches
- Match Results: **X qualified, Y needMoreInfo, Z notQualified**

### Scenario 2: User Provides Multiple Fields at Once

**Turn 1:**
- User: "I need R1M, been trading 3 years, make R300k/month, registered SA business with SA director, have bank statements, in Western Cape, VAT registered"
- Profile: `{amountRequested: 1000000, yearsTrading: 3, monthlyTurnover: 300000, saRegistered: true, saDirector: true, bankStatements: true, province: "Western Cape", vatRegistered: true}`
- `hasHardRequirements()`: **TRUE** ✅
- Frank: Generates full AI response with qualified matches immediately
- Match Results: **Should have qualified lenders!**

## Key Changes Made

1. **Fixed Early Exit Logic** ([lib/openai-client.ts:104-115](lib/openai-client.ts#L104-L115))
   - Now uses `nextQuestionGroup()` to progressively ask for missing fields
   - Previously was stuck asking for Group 1 repeatedly

2. **Updated Extraction Examples** ([lib/openai-client.ts:67-81](lib/openai-client.ts#L67-L81))
   - Added examples for SA registration, director, bank statements
   - Helps gpt-5 correctly extract these boolean fields

3. **Improved Question Flow** ([lib/flow.ts:18-42](lib/flow.ts#L18-L42))
   - Clear comments explaining each question group
   - Better wording for "monthly turnover" (was "annual revenue")

## Why Matching Was Broken

**Before Fix:**
- Filter logic at [lib/filters.ts:134-155](lib/filters.ts#L134-L155) requires ALL hard fields including new ones
- But conversation flow kept asking only for Group 1 fields repeatedly
- Result: Profile never got complete → ALL lenders in `needMoreInfo` forever

**After Fix:**
- Conversation flow now asks for Group 1 → Group 2 → Group 3 → Group 4 → Group 5
- Once all hard requirements collected, matching activates properly
- Lenders can now be categorized into qualified/notQualified/needMoreInfo correctly

## Testing Checklist

- [ ] Initial "hey" → Frank asks for Group 1 (basics)
- [ ] Provide basics → Frank asks for Group 2 (SA registration)
- [ ] Provide SA info → Frank asks for Group 3 (bank statements)
- [ ] Provide bank statements → Frank asks for Group 4 (province/VAT)
- [ ] Provide province/VAT → Frank shows qualified matches
- [ ] Verify match counts are correct (not all in needMoreInfo)
- [ ] Test providing all info at once → immediate matches
