# Responses API Quick Reference

## Basic Usage

### Simple Text Generation
```typescript
const response = await openai.responses.create({
  model: "gpt-5",
  input: "What is the capital of France?"
});

console.log(response.output_text);
```

### With Instructions (System Prompt)
```typescript
const response = await openai.responses.create({
  model: "gpt-5",
  instructions: "You are a helpful funding advisor.",
  input: "I need R500k for my business"
});

console.log(response.output_text);
```

### Structured Outputs (JSON Schema)
```typescript
const response = await openai.responses.create({
  model: "gpt-5",
  instructions: "Extract business information from the user message.",
  input: "I run a restaurant, been trading 2 years, make 300k a month",
  text: {
    format: {
      type: "json_schema",
      name: "BusinessExtraction",
      schema: {
        type: "object",
        properties: {
          industry: { type: "string" },
          yearsTrading: { type: "number" },
          monthlyTurnover: { type: "number" }
        },
        required: ["industry"],
        additionalProperties: false
      },
      strict: true
    }
  }
});

const data = JSON.parse(response.output_text);
console.log(data.industry); // "Restaurant"
```

### Streaming Responses
```typescript
const stream = await openai.responses.create({
  model: "gpt-5",
  input: "Tell me about funding options",
  stream: true
});

for await (const event of stream) {
  if (event.type === 'response.output_text.delta') {
    process.stdout.write(event.delta);
  }
}
```

### With Reasoning Control
```typescript
const response = await openai.responses.create({
  model: "gpt-5",
  reasoning: { effort: "low" },  // "low", "medium", "high"
  input: "Quick answer: best funding for retail?",
  max_output_tokens: 150
});
```

### Stateless vs Stateful
```typescript
// Stateless (default for our use case)
const response = await openai.responses.create({
  model: "gpt-5",
  input: "Hello",
  store: false  // Don't store conversation history
});

// Stateful (stores conversation)
const response = await openai.responses.create({
  model: "gpt-5",
  input: "Hello",
  store: true  // OpenAI stores the conversation
});
```

### Multi-turn with previous_response_id
```typescript
// First message
const res1 = await openai.responses.create({
  model: "gpt-5",
  input: "What is the capital of France?",
  store: true
});

// Follow-up using previous response ID
const res2 = await openai.responses.create({
  model: "gpt-5",
  input: "What's its population?",
  previous_response_id: res1.id,
  store: true
});
```

### Multi-turn with Manual Context
```typescript
// Build context manually
let context = [
  { role: "user", content: "What is the capital of France?" }
];

const res1 = await openai.responses.create({
  model: "gpt-5",
  input: context
});

// Add response to context
context = [
  ...context,
  ...res1.output  // Append the model's output
];

// Add next user message
context.push({ role: "user", content: "What's its population?" });

const res2 = await openai.responses.create({
  model: "gpt-5",
  input: context
});
```

## Common Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | Model to use (e.g., "gpt-5") |
| `input` | string \| array | User input (string or message array) |
| `instructions` | string | System-level instructions (replaces system role) |
| `reasoning` | object | `{ effort: "low" \| "medium" \| "high" }` |
| `max_output_tokens` | number | Maximum tokens to generate |
| `store` | boolean | Whether to store conversation (default: true) |
| `stream` | boolean | Enable streaming responses |
| `text.format` | object | Structured output format (JSON schema) |
| `previous_response_id` | string | Reference a previous response for context |
| `tools` | array | Enable built-in tools (web_search, file_search, etc.) |

## Response Object

```typescript
{
  id: "resp_abc123...",
  object: "response",
  created_at: 1234567890,
  model: "gpt-5-2025-08-07",
  output: [
    {
      id: "msg_xyz789",
      type: "message",
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "The generated text..."
        }
      ]
    }
  ],
  output_text: "The generated text..."  // Helper property
}
```

## Stream Event Types

```typescript
event.type === 'response.created'              // Response started
event.type === 'response.output_item.added'    // Output item added
event.type === 'response.output_text.delta'    // Text chunk (use event.delta)
event.type === 'response.output_text.done'     // Text generation complete
event.type === 'response.done'                 // Response complete
```

## Migration from Chat Completions

### Before (Chat Completions)
```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: "You are helpful." },
    { role: "user", content: "Hello" }
  ],
  temperature: 0.7,
  max_tokens: 150
});

const text = completion.choices[0].message.content;
```

### After (Responses API)
```typescript
const response = await openai.responses.create({
  model: "gpt-5",
  reasoning: { effort: "low" },
  instructions: "You are helpful.",
  input: "Hello",
  max_output_tokens: 150
});

const text = response.output_text;
```

## Best Practices

1. **Use `store: false`** for stateless applications (saves costs)
2. **Set `reasoning.effort`** appropriately:
   - `"low"` - Quick tasks, chat, simple extraction
   - `"medium"` - Default reasoning
   - `"high"` - Complex problem-solving
3. **Use `strict: true`** with structured outputs for reliability
4. **Limit `max_output_tokens`** to prevent excessive token usage
5. **Use `previous_response_id`** for simpler multi-turn conversations
6. **Access text via `output_text` helper** instead of navigating the output array

## Error Handling

```typescript
try {
  const response = await openai.responses.create({
    model: "gpt-5",
    input: "Hello"
  });

  console.log(response.output_text);
} catch (error) {
  if (error.status === 429) {
    console.error("Rate limit exceeded");
  } else if (error.status === 400) {
    console.error("Invalid request:", error.message);
  } else {
    console.error("OpenAI error:", error);
  }
}
```

## Built-in Tools

```typescript
// Enable web search
const response = await openai.responses.create({
  model: "gpt-5",
  input: "What's the latest on SA funding regulations?",
  tools: [{ type: "web_search" }]
});

// Enable multiple tools
const response = await openai.responses.create({
  model: "gpt-5",
  input: "Analyze this document and search for related info",
  tools: [
    { type: "file_search" },
    { type: "web_search" },
    { type: "code_interpreter" }
  ]
});
```

## Additional Resources

- [OpenAI Responses API Docs](https://platform.openai.com/docs/guides/text)
- [Migration Guide](https://platform.openai.com/docs/guides/migrate-to-responses)
- [Function Calling](https://platform.openai.com/docs/guides/function-calling)
