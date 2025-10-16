# Frank GPT-5 Tool-Based Chat - Testing Guide

## Quick Start

### 1. Start Development Server
```bash
npm run dev
# or
pnpm dev
```

### 2. Run Test Script
```bash
./scripts/test-tool-chat.sh
```

## Manual Testing

### Test Case 1: Greeting (Minimal Tools)
**Expected**: Model should respond conversationally without calling many tools.

```bash
curl -X POST http://localhost:3000/api/chat-tools \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hi there!",
    "chatHistory": [],
    "userId": "test_user_001",
    "sessionId": "test_session_001"
  }'
```

**Expected Response**:
```json
{
  "summary": "Hi! I'm Frank. I help SA businesses find funding...",
  "toolCallsMade": 1,
  "success": true
}
```

**Expected Tool Calls**:
- `get_business_profile()` (to check if user has existing profile)

---

### Test Case 2: Complete Profile in One Message
**Expected**: Model should extract ALL fields at once and search lenders immediately.

```bash
curl -X POST http://localhost:3000/api/chat-tools \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need R500k for my retail business in Gauteng, been trading 3 years, monthly turnover is R300k, VAT registered",
    "chatHistory": [],
    "userId": "test_user_002",
    "sessionId": "test_session_002"
  }'
```

**Expected Response**:
```json
{
  "summary": "Perfect! I've saved your details and found 6 lenders ready to fund you:\n• Lulalend (R20k-R2m, 2-3 days)\n• Merchant Capital...",
  "toolCallsMade": 3,
  "success": true
}
```

**Expected Tool Calls**:
1. `get_business_profile()` → empty profile
2. `update_business_profile({industry, yearsTrading, monthlyTurnover, amountRequested, vatRegistered, province})`
3. `search_lenders(useCurrentProfile: true)` → returns 6+ qualified lenders

---

### Test Case 3: Incremental Data Collection
**Expected**: Model should ask for missing fields conversationally.

```bash
curl -X POST http://localhost:3000/api/chat-tools \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need funding",
    "chatHistory": [],
    "userId": "test_user_003",
    "sessionId": "test_session_003"
  }'
```

**Expected Response**:
```json
{
  "summary": "Great! Let's get you matched. Tell me about your business - what industry, how long trading, monthly turnover, and how much you need?",
  "toolCallsMade": 1,
  "success": true
}
```

**Expected Tool Calls**:
- `get_business_profile()` → empty profile

---

### Test Case 4: Lender-Specific Question
**Expected**: Model should call get_lender_requirements() and provide detailed info.

```bash
curl -X POST http://localhost:3000/api/chat-tools \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me about Lulalend requirements",
    "chatHistory": [],
    "userId": "test_user_004",
    "sessionId": "test_session_004"
  }'
```

**Expected Response**:
```json
{
  "summary": "Lulalend offers R20k to R2m with these requirements:\n• Minimum 1 year trading\n• R50k+ monthly turnover...",
  "toolCallsMade": 1,
  "success": true
}
```

**Expected Tool Calls**:
- `get_lender_requirements(lenderName: "Lulalend")`

---

### Test Case 5: Context Awareness (No Re-asking)
**Expected**: Model should NOT ask for data it already has.

**Step 1**: Provide initial data
```bash
curl -X POST http://localhost:3000/api/chat-tools \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I run a retail store, 3 years trading",
    "chatHistory": [],
    "userId": "test_user_005",
    "sessionId": "test_session_005"
  }'
```

**Step 2**: Follow up (should NOT re-ask for industry/years)
```bash
curl -X POST http://localhost:3000/api/chat-tools \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Need R500k",
    "chatHistory": [
      {"role": "user", "content": "I run a retail store, 3 years trading"},
      {"role": "assistant", "content": "Great! I'\''ve saved that..."}
    ],
    "userId": "test_user_005",
    "sessionId": "test_session_005"
  }'
```

**Expected**: Model should reference existing data and only ask for missing fields (turnover, province, etc.).

---

## Debugging

### Enable Verbose Logging
Check server console for detailed tool execution logs:
```
💬 FrankAI Tools Chat: { message, userId, sessionId }
🔄 Iteration 1/10
📤 Model response: { outputItems: 3, types: [...] }
🔧 Function calls found: 2
⚙️  Executing tool 1: get_business_profile
✅ Tool result: { success: true, profile: {...} }
```

### Common Issues

#### Issue: "Missing required fields" error
**Cause**: userId or sessionId not provided in request
**Fix**: Ensure both are included in POST body

#### Issue: Tool calls not executing
**Cause**: OpenAI API key not set or invalid
**Fix**: Check `NEXT_PUBLIC_OPENAI_API_KEY` in `.env.local`

#### Issue: "Unknown tool" error
**Cause**: Tool name mismatch between definition and executor
**Fix**: Check `lib/tools/index.ts` ToolNames match handler switch cases

#### Issue: TypeScript errors
**Cause**: Missing dependencies or type issues
**Fix**: Run `npm install` and `npx tsc --noEmit`

---

## Integration with UI

### Update `app/page.tsx`
Replace the old chat endpoint with the new tool-based one:

```typescript
// OLD (remove)
const result = await fetch('/api/chat', { ... });

// NEW (use this)
const result = await fetch('/api/chat-tools', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message,
    chatHistory,
    userId: user.id,
    sessionId: session.id
  })
});

const data = await result.json();
console.log('Tool calls made:', data.toolCallsMade);
// Use data.summary for display
```

---

## Performance Metrics

### Expected Response Times
- **Simple chat** (greeting): ~500-800ms
- **With tools** (1-3 calls): ~2-3 seconds
- **Complex flow** (5+ calls): ~4-6 seconds

### Expected Tool Call Counts
- **Greeting**: 1 call (get_business_profile)
- **Data extraction**: 2 calls (get + update)
- **Full matching**: 3 calls (get + update + search)
- **Lender query**: 1 call (get_lender_requirements)

### Token Usage
- **Medium reasoning effort**: ~800-1500 input tokens per turn
- **Output tokens**: ~300-600 per response
- **Context growth**: +200 tokens per tool call

---

## Success Criteria

✅ **Tool calls execute successfully**
- No "Unknown tool" errors
- All tool handlers return valid responses

✅ **No re-asking for data**
- Model checks profile first
- References existing data in responses

✅ **Batch extraction works**
- Multiple fields extracted from single message
- All extracted data saved immediately

✅ **Real lender data returned**
- search_lenders() returns actual database results
- Lender names, amounts, and speeds are accurate

✅ **Tool preambles present**
- Model explains what it's doing before calling tools
- Example: "Let me check what info we have..." before get_business_profile()

---

## Next Steps After Testing

1. **Verify all test cases pass**
2. **Check server logs for any errors**
3. **Test edge cases** (invalid province, unknown lender, etc.)
4. **Update UI** to use new endpoint
5. **Remove old code**:
   - Deprecate `lib/flow.ts`
   - Remove hardcoded extraction logic
   - Clean up unused imports

6. **Monitor in production**:
   - Track tool call counts
   - Monitor response times
   - Watch for failed tool executions
