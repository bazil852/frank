# GPT-5 Function Calling Architecture for Frank

## Overview
Redesign Frank to leverage GPT-5's native function calling capabilities, eliminating hardcoded question flows and enabling autonomous data extraction with direct Supabase access.

## Current Problems

### 1. **Hardcoded Question Flow**
```typescript
// lib/flow.ts - RIGID, INFLEXIBLE
export function nextQuestionGroup(p: Partial<Profile>): string | null {
  if (miss('industry')) return '• What industry are you in?';
  if (miss('yearsTrading')) return '• How long have you been trading?';
  // ... more hardcoded questions
}
```

**Issues:**
- ❌ Inflexible conversation flow
- ❌ Can't adapt to user's natural language
- ❌ Asks one field at a time (slow)
- ❌ No context awareness

### 2. **Manual JSON Schema Extraction**
```typescript
// Current approach - LIMITED
const extraction = await openai.responses.create({
  text: {
    format: { type: "json_schema", ... }
  }
});
```

**Issues:**
- ❌ Model just guesses field values
- ❌ No validation against real data
- ❌ Can't check province validity
- ❌ Can't verify lender requirements
- ❌ No database interaction

### 3. **No Tool Access**
- ❌ Can't query Supabase for lender data
- ❌ Can't validate provinces/industries
- ❌ Can't check if business already exists
- ❌ Can't save data incrementally

## New Architecture: Function Calling with Tools

### Design Principles

1. **Model-Driven Extraction**: Let GPT-5 decide what to ask and when
2. **Tool-First**: Give model direct access to data sources
3. **Incremental Updates**: Save data as it's extracted
4. **Validation**: Use tools to validate user input
5. **Transparency**: Use preambles to explain reasoning

### Tool Catalog

#### 1. **`get_business_profile`** - Read Current Profile
```typescript
{
  type: "function",
  name: "get_business_profile",
  description: "Retrieves the current business profile for this user session.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false
  }
}
```

**Purpose:** Check what data we already have before asking

#### 2. **`update_business_profile`** - Save Profile Data
```typescript
{
  type: "function",
  name: "update_business_profile",
  description: "Updates the user's business profile with new information extracted from conversation. Can update multiple fields at once.",
  parameters: {
    type: "object",
    properties: {
      industry: { type: "string" },
      yearsTrading: { type: "number" },
      monthlyTurnover: { type: "number" },
      amountRequested: { type: "number" },
      vatRegistered: { type: "boolean" },
      province: { type: "string" },
      saRegistered: { type: "boolean" },
      saDirector: { type: "boolean" },
      bankStatements: { type: "boolean" },
      urgencyDays: { type: "number" },
      collateralAcceptable: { type: "boolean" },
      useOfFunds: { type: "string" }
    },
    additionalProperties: false
  }
}
```

**Purpose:** Save extracted data incrementally to Supabase

#### 3. **`search_lenders`** - Query Matching Lenders
```typescript
{
  type: "function",
  name: "search_lenders",
  description: "Searches for lenders matching the current business profile. Returns qualified lenders, near-misses, and rejection reasons.",
  parameters: {
    type: "object",
    properties: {
      minAmount: { type: "number" },
      maxAmount: { type: "number" },
      minYears: { type: "number" },
      province: { type: "string" },
      vatRegistered: { type: "boolean" }
    },
    additionalProperties: false
  }
}
```

**Purpose:** Real-time lender matching with Supabase queries

#### 4. **`validate_province`** - Validate SA Province
```typescript
{
  type: "function",
  name: "validate_province",
  description: "Validates if a province name is a valid South African province. Returns the standardized name if valid.",
  parameters: {
    type: "object",
    properties: {
      province: {
        type: "string",
        description: "Province name to validate (e.g., 'Gauteng', 'Western Cape', 'KZN')"
      }
    },
    required: ["province"],
    additionalProperties: false
  }
}
```

**Purpose:** Validate and standardize province names

#### 5. **`get_lender_requirements`** - Get Specific Lender Info
```typescript
{
  type: "function",
  name: "get_lender_requirements",
  description: "Gets detailed requirements for a specific lender including amounts, criteria, speed, and notes.",
  parameters: {
    type: "object",
    properties: {
      lenderName: {
        type: "string",
        description: "Name of the lender (e.g., 'Lulalend', 'Bridgement')"
      }
    },
    required: ["lenderName"],
    additionalProperties: false
  }
}
```

**Purpose:** Answer specific lender questions

#### 6. **`calculate_eligibility`** - Eligibility Check
```typescript
{
  type: "function",
  name: "calculate_eligibility",
  description: "Calculates eligibility for a specific lender based on current profile. Returns match percentage and missing requirements.",
  parameters: {
    type: "object",
    properties: {
      lenderId: { type: "string" },
      profileOverride: {
        type: "object",
        description: "Optional profile overrides to test 'what if' scenarios"
      }
    },
    required: ["lenderId"],
    additionalProperties: false
  }
}
```

**Purpose:** "What if" scenarios and eligibility calculations

### Custom Tools for Complex Queries

#### 7. **`query_supabase`** - Direct SQL Access (Custom Tool)
```typescript
{
  type: "custom",
  name: "query_supabase",
  description: "Executes a read-only PostgreSQL query against the lenders database. Use for complex queries not covered by other tools.",
  format: {
    type: "grammar",
    syntax: "regex",
    definition: "^SELECT .+ FROM lenders( WHERE .+)?( ORDER BY .+)?( LIMIT \\d+)?;$"
  }
}
```

**Purpose:** Complex SQL queries with grammar constraints

### Tool Preambles for Transparency

Enable preambles in system instructions:
```typescript
instructions: `You are Frank, SA funding matcher.

**IMPORTANT:** Before calling any tool, briefly explain why you're calling it.
Examples:
- "Let me check what information we already have..." → get_business_profile()
- "I'll save those details now..." → update_business_profile()
- "Let me find lenders matching your criteria..." → search_lenders()

This helps users understand your reasoning process.`
```

## Implementation Plan

### Phase 1: Tool Infrastructure (Week 1)

**Files to Create:**
1. `lib/tools/business-profile.ts` - Profile CRUD tools
2. `lib/tools/lender-search.ts` - Lender matching tools
3. `lib/tools/validation.ts` - Validation tools
4. `lib/tools/index.ts` - Tool registry
5. `lib/tools/handlers.ts` - Tool execution logic

**Example: `lib/tools/business-profile.ts`**
```typescript
import { supabase } from '@/lib/supabase';

export const businessProfileTools = [
  {
    type: "function" as const,
    name: "get_business_profile",
    description: "Retrieves the current business profile for this user session.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false
    }
  },
  {
    type: "function" as const,
    name: "update_business_profile",
    description: "Updates the user's business profile with new information. Can update multiple fields at once.",
    parameters: {
      type: "object",
      properties: {
        industry: { type: "string" },
        yearsTrading: { type: "number" },
        monthlyTurnover: { type: "number" },
        amountRequested: { type: "number" },
        vatRegistered: { type: "boolean" },
        province: { type: "string" },
        saRegistered: { type: "boolean" },
        saDirector: { type: "boolean" },
        bankStatements: { type: "boolean" }
      },
      additionalProperties: false
    }
  }
];

export async function handleBusinessProfileTool(
  toolName: string,
  args: any,
  userId: string
): Promise<string> {
  if (toolName === 'get_business_profile') {
    const profile = await ConversationTracker.getUserBusinessProfile();
    return JSON.stringify(profile || {});
  }

  if (toolName === 'update_business_profile') {
    await ConversationTracker.updateUserBusinessProfile(args);
    return JSON.stringify({ success: true, updated: args });
  }

  throw new Error(`Unknown tool: ${toolName}`);
}
```

### Phase 2: Update openai-client.ts (Week 1)

**Remove:**
- ❌ `extractBusinessInfo()` - replaced by tools
- ❌ Manual JSON schema extraction
- ❌ Hardcoded field checking

**Add:**
```typescript
// lib/openai-client.ts
import { allTools, executeToolCall } from './tools';

export class FrankAI {
  static async chat(
    message: string,
    chatHistory: Array<{ role: string; content: string }> = [],
    userId: string,
    sessionId: string
  ): Promise<GPTResponse> {

    let conversationContext = [
      ...chatHistory,
      { role: "user", content: message }
    ];

    // Loop until model stops calling tools
    let continueLoop = true;
    let iterationCount = 0;
    const maxIterations = 10;

    while (continueLoop && iterationCount < maxIterations) {
      iterationCount++;

      const response = await openai.responses.create({
        model: "gpt-5",
        reasoning: { effort: "medium" }, // Better reasoning for extraction
        instructions: this.getSystemPromptWithTools(),
        input: conversationContext,
        tools: allTools,
        max_output_tokens: 500,
        store: false
      });

      // Add model's response to context
      conversationContext = [...conversationContext, ...response.output];

      // Check for function calls
      const functionCalls = response.output.filter(
        item => item.type === 'function_call'
      );

      if (functionCalls.length === 0) {
        // No more tools to call, return final response
        continueLoop = false;
        return {
          summary: response.output_text,
          extracted: {} // No longer needed
        };
      }

      // Execute all function calls
      for (const call of functionCalls) {
        const result = await executeToolCall(
          call.name,
          JSON.parse(call.arguments),
          userId,
          sessionId
        );

        // Add function result to context
        conversationContext.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result)
        });
      }
    }

    // Fallback if max iterations reached
    return {
      summary: "I've processed your information. What else can I help with?",
      extracted: {}
    };
  }

  private static getSystemPromptWithTools(): string {
    return `You are Frank — SA funding matcher. Sharp, helpful, conversational.

**YOUR TOOLS:**
You have direct access to:
- get_business_profile: Check what data we already have
- update_business_profile: Save extracted information
- search_lenders: Find matching lenders
- validate_province: Validate SA provinces
- get_lender_requirements: Get specific lender details
- calculate_eligibility: Check eligibility

**TOOL USAGE PROTOCOL:**
1. **Always check existing profile first** using get_business_profile()
2. **Never re-ask for data** you can see in the profile
3. **Extract and save immediately** using update_business_profile()
4. **Use search_lenders()** to show real-time matches
5. **Before calling any tool**, explain why in 1 sentence (preamble)

**CONVERSATION FLOW:**
1. Start: "I'm Frank — shortcut to funding. Tell me about your business."
2. Extract ALL info from user message (not one field at a time)
3. Save immediately using update_business_profile()
4. Search lenders if we have enough data
5. Present results with context

**CRITICAL RULES:**
- Extract multiple fields from one message (don't ask field-by-field)
- Call update_business_profile() immediately after extraction
- Use search_lenders() to show real-time matching results
- Reference actual lender names from search results
- Be specific and data-driven`;
  }
}
```

### Phase 3: Tool Execution Router (Week 1)

**File: `lib/tools/handlers.ts`**
```typescript
import { handleBusinessProfileTool } from './business-profile';
import { handleLenderSearchTool } from './lender-search';
import { handleValidationTool } from './validation';

export async function executeToolCall(
  toolName: string,
  args: any,
  userId: string,
  sessionId: string
): Promise<any> {
  console.log(`🔧 Executing tool: ${toolName}`, args);

  // Route to appropriate handler
  if (['get_business_profile', 'update_business_profile'].includes(toolName)) {
    return handleBusinessProfileTool(toolName, args, userId);
  }

  if (['search_lenders', 'get_lender_requirements', 'calculate_eligibility'].includes(toolName)) {
    return handleLenderSearchTool(toolName, args);
  }

  if (['validate_province'].includes(toolName)) {
    return handleValidationTool(toolName, args);
  }

  throw new Error(`Unknown tool: ${toolName}`);
}
```

### Phase 4: Update UI (Week 2)

**Changes to app/page.tsx:**
```typescript
// Remove manual filtering logic - tools handle this
const handleChatMessage = async (message: string, chatHistory: any[]) => {
  try {
    setIsProcessing(true);

    // Just pass to AI - it handles everything
    const result = await FrankAI.chat(message, chatHistory, userId, sessionId);

    setIsProcessing(false);
    return result.summary;
  } catch (error) {
    console.error('Chat error:', error);
    setIsProcessing(false);
    return 'Sorry, I encountered an error. Please try again.';
  }
};
```

## Benefits

### 1. **Intelligent Extraction**
- ✅ Model decides what to ask based on context
- ✅ Extracts multiple fields from one message
- ✅ Adapts to user's natural language
- ✅ No hardcoded question flow

### 2. **Real-Time Validation**
- ✅ Validates provinces against actual data
- ✅ Checks lender requirements dynamically
- ✅ Provides instant feedback

### 3. **Database Integration**
- ✅ Direct Supabase access via tools
- ✅ Incremental data saving
- ✅ Real-time lender searches
- ✅ Complex SQL queries when needed

### 4. **Better UX**
- ✅ Faster conversations (batch extraction)
- ✅ Transparent reasoning (preambles)
- ✅ Context-aware responses
- ✅ Dynamic matching

### 5. **Reasoning Control**
```typescript
// Fast chat: minimal reasoning
reasoning: { effort: "minimal" }

// Data extraction: medium reasoning
reasoning: { effort: "medium" }

// Complex eligibility: high reasoning
reasoning: { effort: "high" }
```

## Example Conversation Flow

### Old Way (Hardcoded)
```
User: I need R500k for my retail business
Frank: Got it. How long have you been trading?
User: 3 years
Frank: What's your monthly turnover?
User: R300k
Frank: Are you VAT registered?
User: Yes
Frank: Which province?
User: Gauteng
```
**6 exchanges** ❌

### New Way (Tool-Driven)
```
User: I need R500k for my retail business, been trading 3 years, make R300k monthly, VAT registered, in Gauteng

Frank: [Preamble] "Let me save those details and find matches..."
[Calls: update_business_profile(), search_lenders()]

Frank: "Perfect! You've got 6 lenders ready:
• Lulalend (R20k-R2m, 2-3 days)
• Merchant Capital (R50k-R5m, 1-2 days)
... [real data from search_lenders()]

Want details on any of these?"
```
**1 exchange** ✅

## Migration Strategy

### Week 1: Tools + Core
- Create tool definitions
- Build tool handlers
- Update openai-client.ts
- Test with simple queries

### Week 2: Integration
- Update UI components
- Remove old extraction logic
- Add preamble support
- Test full flow

### Week 3: Advanced Features
- Add custom SQL tool
- Implement "what if" scenarios
- Add tool preambles
- Optimize reasoning levels

### Week 4: Testing & Polish
- End-to-end testing
- Performance optimization
- Error handling
- Documentation

## Next Steps

1. **Review this architecture** - does it meet requirements?
2. **Start with Phase 1** - build tool infrastructure
3. **Test incrementally** - validate each tool
4. **Iterate** - refine based on real usage

Ready to start implementing? 🚀
