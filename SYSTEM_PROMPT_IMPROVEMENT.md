# System Prompt Improvement - Model Not Calling Tools

## The Problem

After fixing the server-side userId bug, the model was still not extracting and saving data properly.

### Observed Behavior

```
User: "construction, trading for 5 years, 100k turnover and 1 million needed"

Iteration 1:
  ✅ Tool: get_business_profile() → empty profile

Iteration 2:
  ❌ Model response: { outputItems: 1, types: [ 'reasoning' ] }
  ❌ Function calls found: 0
  ❌ STOPPED - No extraction, no update, no search
```

The model was:
1. ✅ Calling `get_business_profile()` successfully
2. ❌ **NOT extracting** data from user message
3. ❌ **NOT calling** `update_business_profile()`
4. ❌ **NOT calling** `search_lenders()`
5. ❌ Just reasoning and stopping

## Root Cause

The original system prompt was too vague:

```
**CRITICAL TOOL USAGE PROTOCOL:**

1. **ALWAYS START by calling get_business_profile()**
2. **Extract ALL information from user messages**
3. **Call update_business_profile() IMMEDIATELY**
4. **Use search_lenders() when you have enough data**
```

Problems:
- No concrete examples
- No extraction rules (how to parse "5 years" → `yearsTrading: 5`)
- No explicit workflow
- Too abstract - model didn't understand what to do

## The Solution

### 1. Added Explicit Example Flow

```markdown
**EXAMPLE FLOW:**
User: "construction, 5 years trading, 100k turnover, need 1 million"

Your actions (DO THIS):
1. get_business_profile() → check existing data
2. update_business_profile({
     industry: "Construction",
     yearsTrading: 5,
     monthlyTurnover: 100000,
     amountRequested: 1000000
   })
3. search_lenders(useCurrentProfile: true)
4. Respond: "Great! I found 8 lenders for your construction business..."
```

### 2. Added Extraction Rules

```markdown
**EXTRACTION RULES:**
- "construction" → industry: "Construction"
- "5 years" / "5 years trading" → yearsTrading: 5
- "100k turnover" / "R100k" → monthlyTurnover: 100000
- "1 million" / "1m" → amountRequested: 1000000
- "Gauteng" / "Western Cape" → province: "Gauteng"
- "VAT registered" → vatRegistered: true
```

### 3. Strengthened Critical Rules

```markdown
**CRITICAL:**
- ALWAYS extract data from user messages, even if incomplete
- ALWAYS call update_business_profile() when you extract anything
- NEVER just respond without calling tools first
- Save partial data - don't wait for all fields

If user says "hey" or "hello" → ask about their business
If user provides ANY business info → extract it and call update_business_profile()
If you have 4+ key fields → call search_lenders() and show matches
```

### 4. Increased Reasoning Effort

```typescript
// BEFORE
reasoning: { effort: "medium" },
max_output_tokens: 600,

// AFTER
reasoning: { effort: "high" },  // Complex multi-step extraction + tool sequencing
max_output_tokens: 800,  // More space for reasoning
```

## Expected Behavior After Fix

```
User: "construction, trading for 5 years, 100k turnover and 1 million needed"

Iteration 1:
  🔧 Tool: get_business_profile()
  ✅ Result: {}

Iteration 2:
  🔧 Tool: update_business_profile({
       industry: "Construction",
       yearsTrading: 5,
       monthlyTurnover: 100000,
       amountRequested: 1000000
     })
  ✅ Profile saved to DB

Iteration 3:
  🔧 Tool: search_lenders(useCurrentProfile: true)
  ✅ Found 8 qualified lenders

Iteration 4:
  💬 Response: "Great! I've found 8 lenders for your construction business:
    • Lulalend (R20k-R2m, 2-3 days)
    • Merchant Capital (R50k-R3m, 1-2 weeks)
    ..."
```

## Files Modified

**[lib/openai-client-tools.ts](lib/openai-client-tools.ts:21-71)**

**Changes:**
1. Replaced abstract protocol with concrete example
2. Added extraction rules showing exact mappings
3. Strengthened critical rules (ALWAYS, NEVER)
4. Added conditional rules (if/then statements)
5. Increased reasoning effort: `medium` → `high`
6. Increased max tokens: `600` → `800`

## Why This Works

### Concrete Example
Shows the model **exactly** what to do with a real user message. The model can pattern-match this example to new messages.

### Extraction Rules
Provides explicit mapping between natural language and structured data:
- "5 years" → extract as `yearsTrading: 5`
- "100k" → parse as `monthlyTurnover: 100000`
- "construction" → capitalize as `industry: "Construction"`

### Imperative Language
Uses strong directives:
- "MUST follow this EXACTLY"
- "ALWAYS call update_business_profile()"
- "NEVER just respond without calling tools"

### Conditional Rules
Clear if/then logic:
```
If user provides ANY business info → extract it and call update_business_profile()
If you have 4+ key fields → call search_lenders() and show matches
```

### Higher Reasoning Effort
`effort: "high"` gives the model more compute for:
- Complex multi-field extraction
- Multi-tool sequencing logic
- Natural language → structured data mapping

## Comparison

### Before (Abstract)
```
**CRITICAL TOOL USAGE PROTOCOL:**
1. ALWAYS START by calling get_business_profile()
2. Extract ALL information from user messages
3. Call update_business_profile() IMMEDIATELY
```

Result: Model doesn't understand "extract" or "immediately"

### After (Concrete)
```
**EXAMPLE FLOW:**
User: "construction, 5 years trading, 100k turnover, need 1 million"

Your actions (DO THIS):
1. get_business_profile()
2. update_business_profile({industry: "Construction", yearsTrading: 5, ...})
3. search_lenders(useCurrentProfile: true)
```

Result: Model sees exact pattern to follow

## Testing

Restart the dev server and test:

```bash
npm run dev
```

Then try:

**Test 1: Full data in one message**
```
User: "construction, 5 years trading, 100k turnover, need 1 million"

Expected:
- Iteration 1: get_business_profile()
- Iteration 2: update_business_profile() with 4 fields
- Iteration 3: search_lenders()
- Iteration 4: Response with real lender matches
```

**Test 2: Partial data**
```
User: "I run a construction business"

Expected:
- Iteration 1: get_business_profile()
- Iteration 2: update_business_profile({industry: "Construction"})
- Iteration 3: Response asking for years, turnover, amount
```

**Test 3: Incremental data**
```
User: "construction business"
Frank: [asks for more info]
User: "5 years trading, need 1 million"

Expected:
- Gets existing profile with industry
- Extracts yearsTrading and amountRequested
- Updates profile with new fields
- Asks for turnover
```

## Key Learnings

### ❌ Don't Do This
```
"Extract information from the message"
```
Too vague - model doesn't know what "extract" means

### ✅ Do This
```
User: "5 years trading"
Extract: yearsTrading: 5

Then call: update_business_profile({yearsTrading: 5})
```
Shows exact input → output mapping

### Pattern: Few-Shot Prompting
Instead of describing what to do, **show** what to do with examples:
- Input example
- Tool calls
- Expected output

This is far more effective for complex multi-step tasks.

## Status

✅ **System prompt strengthened with:**
- Concrete example flow
- Explicit extraction rules
- Stronger imperatives (ALWAYS/NEVER)
- Conditional logic (if/then)
- Higher reasoning effort
- More output tokens

**Ready for testing!** 🚀

Restart dev server and test with:
```
"construction, 5 years trading, 100k turnover, need 1 million"
```

Should now see 3-4 tool calls before final response.
