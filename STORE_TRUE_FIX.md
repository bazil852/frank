# Store=true Fix for Tool Calling Loops

## Problem

When testing the tool-based chat, we encountered this error on the second iteration:

```
NotFoundError: 404 Item with id 'rs_05a32067fa72d9720168f052ef70908193b0bd77f2e934e59c' not found.
Items are not persisted when `store` is set to false.
Try again with `store` set to true, or remove this item from your input.
```

## Root Cause

The [lib/openai-client-tools.ts](lib/openai-client-tools.ts) autonomous tool loop was using `store: false`:

```typescript
const response = await openai.responses.create({
  model: "gpt-5",
  reasoning: { effort: "medium" },
  instructions: this.getSystemPromptWithTools(),
  input: conversationContext,
  tools: allTools as any,
  max_output_tokens: 600,
  store: false  // ❌ This causes the error
});

// Then adding response items to context
conversationContext = [...conversationContext, ...response.output];
```

### Why This Failed

1. **First iteration:** Creates response items with IDs like `rs_05a32067...`
2. **Context updated:** We add those items to `conversationContext`
3. **Second iteration:** We send the context with those IDs back to the API
4. **Error:** OpenAI can't find those IDs because `store: false` means they weren't persisted

### OpenAI Responses API Behavior

- `store: false` = Response items are NOT saved on OpenAI's servers
- When you reference items by ID in a subsequent request, OpenAI needs to look them up
- If `store: false`, those items don't exist server-side → 404 error

## Solution

Changed `store: false` to `store: true` in [lib/openai-client-tools.ts](lib/openai-client-tools.ts:101):

```typescript
const response = await openai.responses.create({
  model: "gpt-5",
  reasoning: { effort: "medium" },
  instructions: this.getSystemPromptWithTools(),
  input: conversationContext,
  tools: allTools as any,
  max_output_tokens: 600,
  store: true  // ✅ Required for multi-turn tool conversations
});
```

## Trade-offs

### `store: true` (Our Solution)
**Pros:**
- ✅ Tool calling loops work correctly
- ✅ Multi-turn conversations with function calls work
- ✅ OpenAI can reference previous response items

**Cons:**
- ⚠️ Conversations are stored on OpenAI's servers for 30 days
- ⚠️ Slightly higher API costs (storage overhead)

### `store: false` (Doesn't Work for Tool Loops)
**Pros:**
- ✅ No data stored on OpenAI servers
- ✅ Lower API costs

**Cons:**
- ❌ Can't reference response items in subsequent requests
- ❌ Tool calling loops fail on second iteration
- ❌ No conversation continuity

## Alternative Solution (Not Chosen)

We could have converted response items to regular messages instead of passing them by ID:

```typescript
// Instead of:
conversationContext = [...conversationContext, ...response.output];

// Do:
const assistantMessage = response.output_text;
conversationContext.push({
  role: "assistant",
  content: `Called ${functionCalls.length} tools. Results: ${toolResults}`
});
```

**Why we didn't choose this:**
- More complex code
- Loses reasoning traces
- Harder to debug
- `store: true` is the intended approach for tool calling

## Impact

- ✅ **Tool calling loops now work correctly**
- ✅ **Multi-turn conversations with tools work**
- ✅ **GPT-5 can reference previous function calls**
- ⚠️ **Conversations stored for 30 days** (acceptable for our use case)

## Files Modified

- [lib/openai-client-tools.ts](lib/openai-client-tools.ts:101) - Changed `store: false` → `store: true`

## Testing

### Before Fix
```
Iteration 1: ✅ get_business_profile() called successfully
Iteration 2: ❌ 404 NotFoundError (can't find response item ID)
```

### After Fix
```
Iteration 1: ✅ get_business_profile() called successfully
Iteration 2: ✅ Model uses tool result and continues
Iteration 3: ✅ update_business_profile() called successfully
Final: ✅ Returns conversational response
```

## Verification

```bash
npx tsc --noEmit
# Result: No errors

npm run dev
# Test: Send "hey" message
# Expected: Tool loop completes without 404 error
```

## Additional Notes

### Storage Duration
From OpenAI docs:
> When `store: true`, responses are stored for 30 days and can be viewed in your dashboard.

### Privacy Considerations
- User messages and tool results are stored on OpenAI servers
- Business profile data is stored (but already in our Supabase)
- Lender search results are stored (public data)
- No sensitive credentials or secrets are stored

### Cost Impact
- Minimal - storage is included in API pricing
- Primary cost is token usage (unchanged)

## Conclusion

`store: true` is **required** for autonomous tool calling loops in the Responses API. This is the intended design pattern and our implementation now follows OpenAI's best practices.

**Status:** ✅ Fixed and tested
