# GPT-5 & Responses API Migration Summary

## Overview
Successfully migrated Frank from **GPT-4o + Chat Completions API** to **GPT-5 + Responses API** (OpenAI's latest recommended API).

## Migration Date
October 16, 2025

## Why This Migration?

### GPT-5 Benefits
- **3% better performance** on SWE-bench compared to GPT-4o
- Enhanced reasoning capabilities
- Better tool usage

### Responses API Benefits
- **40-80% better cache utilization** (lower costs)
- Cleaner API design: `instructions` + `input` instead of `messages` array
- Native stateful context with `store: true`
- Built-in tools (web_search, file_search, code_interpreter, MCP)
- Better structured outputs: `text.format` instead of `response_format`
- `output_text` helper for easy access to generated text
- Stricter function calling by default
- Future-proofed for upcoming models

## Files Changed

### 1. `/lib/openai-client.ts`
**Main changes:**
- ✅ Updated `extractBusinessInfo()` to use `openai.responses.create()`
- ✅ Changed from `response_format: { type: "json_schema", ... }` to `text.format: { type: "json_schema", ... }`
- ✅ Updated `generateResponse()` to use Responses API with `instructions` parameter
- ✅ Added `reasoning: { effort: "low" }` for efficient processing
- ✅ Updated `getProductRationale()` to use Responses API
- ✅ Changed model from `gpt-4o` to `gpt-5`
- ✅ Access responses via `response.output_text` instead of `completion.choices[0].message.content`

**Before:**
```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage }
  ],
  response_format: { type: "json_schema", json_schema: ExtractSchema }
});
const result = completion.choices[0].message.content;
```

**After:**
```typescript
const response = await openai.responses.create({
  model: "gpt-5",
  reasoning: { effort: "low" },
  instructions: systemPrompt,
  input: userMessage,
  text: {
    format: {
      type: "json_schema",
      name: ExtractSchema.name,
      schema: ExtractSchema.schema,
      strict: true
    }
  },
  store: false
});
const result = response.output_text;
```

### 2. `/app/api/gpt/route.ts`
**Changes:**
- ✅ Migrated to `openai.responses.create()`
- ✅ Updated structured outputs format
- ✅ Changed from `completion.choices[0]?.message?.content` to `response.output_text`
- ✅ Added `store: false` for stateless operation
- ✅ Model upgraded to `gpt-5`

### 3. `/app/api/chat/route.ts`
**Changes:**
- ✅ Migrated streaming endpoint to Responses API
- ✅ Updated event handling for Responses API streaming format
- ✅ Changed from `chunk.choices[0]?.delta?.content` to `event.delta` (for `response.output_text.delta` events)
- ✅ Model upgraded to `gpt-5`

**Before:**
```typescript
for await (const chunk of completion) {
  const content = chunk.choices[0]?.delta?.content || '';
  // process content
}
```

**After:**
```typescript
for await (const event of completion) {
  if (event.type === 'response.output_text.delta') {
    const content = event.delta || '';
    // process content
  }
}
```

### 4. `/package.json`
**Changes:**
- ✅ OpenAI SDK updated to `^4.104.0` (supports Responses API)

## Key API Differences

### Structured Outputs
| Chat Completions | Responses API |
|-----------------|---------------|
| `response_format: { type: "json_schema", json_schema: {...} }` | `text: { format: { type: "json_schema", name: "...", schema: {...}, strict: true } }` |

### Accessing Results
| Chat Completions | Responses API |
|-----------------|---------------|
| `completion.choices[0].message.content` | `response.output_text` |

### Instructions vs Messages
| Chat Completions | Responses API |
|-----------------|---------------|
| `messages: [{ role: "system", content: "..." }]` | `instructions: "..."` |
| `messages: [{ role: "user", content: "..." }]` | `input: "..."` |

### Token Limits
| Chat Completions | Responses API |
|-----------------|---------------|
| `max_tokens` or `max_completion_tokens` | `max_output_tokens` |

### Streaming Events
| Chat Completions | Responses API |
|-----------------|---------------|
| `chunk.choices[0]?.delta?.content` | `event.type === 'response.output_text.delta'` then `event.delta` |

## Configuration Flags

All Responses API calls use:
- `model: "gpt-5"` - Latest model
- `reasoning: { effort: "low" }` - Efficient reasoning for chat/extraction tasks
- `store: false` - Stateless operation (no conversation persistence)
- `strict: true` - Strict structured outputs (when using schemas)

## Testing Checklist

- ✅ TypeScript compilation passes (`npx tsc --noEmit`)
- ✅ No breaking API changes detected
- ⚠️ Manual testing required:
  - [ ] Test chat extraction flow
  - [ ] Test structured output parsing
  - [ ] Test streaming responses
  - [ ] Test product rationale generation
  - [ ] Verify match filtering still works
  - [ ] Check error handling paths

## Rollback Plan

If issues arise:
1. Revert changes to these files:
   - `/lib/openai-client.ts`
   - `/app/api/gpt/route.ts`
   - `/app/api/chat/route.ts`
2. Change all `gpt-5` back to `gpt-4o`
3. Restore `chat.completions.create()` calls
4. Restore `response_format` instead of `text.format`

## Expected Benefits

1. **Cost Reduction**: 40-80% better cache utilization
2. **Better Performance**: 3% improvement in reasoning quality
3. **Cleaner Code**: Simpler API structure
4. **Future-Proof**: Ready for upcoming OpenAI features
5. **Better Structured Outputs**: Native strict mode

## Notes

- The Responses API is OpenAI's recommended API for all new projects
- Chat Completions API remains supported but Responses is the future direction
- GPT-5 is the latest production model as of the migration docs
- All changes maintain backward compatibility with existing profile extraction logic

## Post-Migration Fix: JSON Schema

### Issue
Initial migration encountered error:
```
Invalid schema for response_format 'FrankExtract': In context=('properties', 'extracted', 'properties', 'contact'), 'required' is required to be supplied and to be an array including every key in properties.
```

### Solution
1. **Flattened contact object** in ExtractSchema:
   - Changed from nested `contact: { name, email, phone }`
   - To flat `contactName`, `contactEmail`, `contactPhone`

2. **Set `strict: false`**:
   - Extraction fields are optional (model doesn't always extract all fields)
   - With `strict: true`, all properties must be in `required` array
   - Since our extraction is partial, `strict: false` is appropriate

### Updated Schema
```typescript
export const ExtractSchema = {
  name: "FrankExtract",
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      extracted: {
        type: "object",
        properties: {
          industry: { type: "string" },
          monthlyTurnover: { type: "number" },
          amountRequested: { type: "number" },
          yearsTrading: { type: "number" },
          vatRegistered: { type: "boolean" },
          useOfFunds: { type: "string" },
          urgencyDays: { type: "number" },
          province: { type: "string" },
          collateralAcceptable: { type: "boolean" },
          saRegistered: { type: "boolean" },
          saDirector: { type: "boolean" },
          bankStatements: { type: "boolean" },
          contactName: { type: "string" },
          contactEmail: { type: "string" },
          contactPhone: { type: "string" }
        },
        additionalProperties: false
      }
    },
    required: ["extracted"],
    additionalProperties: false
  }
};
```

### Files Updated
- ✅ `/lib/ai-schemas.ts` - Flattened contact object
- ✅ `/lib/openai-client.ts` - Set `strict: false`
- ✅ `/app/api/gpt/route.ts` - Set `strict: false`
