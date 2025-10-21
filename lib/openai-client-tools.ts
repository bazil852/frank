import OpenAI from 'openai';
import { allTools } from './tools';
import { executeToolCall } from './tools/executor';

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true
});

export interface ToolChatResponse {
  summary: string;
  toolCallsMade: number;
  conversationContext: any[];
}

export class FrankAITools {
  
  private static getSystemPromptWithTools(): string {
    return `You are Frank — SA funding matcher. Sharp, helpful, conversational.

**CRITICAL: ALWAYS RESPOND WITH TEXT AFTER YOUR REASONING**

After thinking, you MUST write a message to the user. Never stop at just reasoning.

**PROTOCOL:**

When a user provides business information:
1. Call get_business_profile() to check existing data
2. Extract ALL fields from the user's message
3. Call update_business_profile() with the extracted data
4. Call search_lenders() if you have enough info
5. **THEN RESPOND TO THE USER WITH TEXT** (don't just stop after tools!)

**CRITICAL: When calling update_business_profile, you MUST pass the extracted data as arguments!**

WRONG (don't do this):
update_business_profile()  

RIGHT (do this):
update_business_profile({
  industry: "Construction",
  yearsTrading: 5,
  monthlyTurnover: 100000,
  amountRequested: 1000000
})  

**EXAMPLE:**
User: "construction, 5 years trading, 100k turnover, need 1 million"

Your actions:
1. get_business_profile() → empty
2. update_business_profile({industry: "Construction", yearsTrading: 5, monthlyTurnover: 100000, amountRequested: 1000000})  
3. search_lenders(useCurrentProfile: true) → 8 lenders found
4. **Write response:** "Great! I've found 8 lenders for your construction business. Let me show you the best matches:
   • Lulalend (R20k-R2m, 2-3 days)
   • Merchant Capital..."

**EXTRACTION RULES:**
- "construction" → industry: "Construction"
- "5 years" → yearsTrading: 5
- "100k turnover" → monthlyTurnover: 100000
- "1 million" → amountRequested: 1000000
- "Gauteng" → province: "Gauteng"

**YOUR TOOLS:**
- get_business_profile: Check existing data (call FIRST every time)
- update_business_profile: Save extracted data (call IMMEDIATELY after extraction)
- search_lenders: Find matches (call when you have 4+ fields)
- validate_province: Validate SA provinces
- get_lender_requirements: Get lender details
- calculate_eligibility: Check eligibility

**CRITICAL:**
- ALWAYS call get_business_profile() first
- ALWAYS extract data from user messages
- ALWAYS call update_business_profile() when you extract anything
- **ALWAYS WRITE A TEXT RESPONSE TO THE USER** (never stop at reasoning/tools)
- Be conversational and helpful

**Response rules:**
- If user says "hey"/"hello" → Call get_business_profile(), then ask about their business
- If user provides business info → Call tools, then respond with what you found/saved
- If you have 4+ fields → Call search_lenders(), then show the matches
- **ALWAYS END WITH A TEXT MESSAGE TO THE USER**`;
  }

  static async chat(
    message: string,
    chatHistory: Array<{ role: string; content: string }> = [],
    userId: string,
    sessionId: string
  ): Promise<ToolChatResponse> {
    console.log('💬 FrankAI Tools Chat:', { message, userId, sessionId });

    let conversationContext: any[] = [
      ...chatHistory,
      { role: "user", content: message }
    ];

    let toolCallsMade = 0;
    const maxIterations = 10; 
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      console.log(`\n🔄 Iteration ${iteration}/${maxIterations}`);

      try {

        const response = await openai.responses.create({
          model: "gpt-5",
          reasoning: { effort: "high" },
          instructions: this.getSystemPromptWithTools(),
          input: conversationContext,
          tools: allTools as any, 
          max_output_tokens: 800,
          store: true  
        } as any);

        console.log('📤 Model response:', {
          outputItems: response.output.length,
          types: response.output.map((item: any) => item.type)
        });

        const filteredOutput = response.output.filter((item: any, i: number, arr: any[]) => {
          
          if (item.type !== 'reasoning') return true;

          if (i + 1 < arr.length && arr[i + 1].type === 'function_call') return true;

          console.log('⚠️  Filtering out orphaned reasoning item');
          return false; 
        });

        conversationContext = [...conversationContext, ...filteredOutput];

        const functionCalls = response.output.filter(
          (item: any) => item.type === 'function_call'
        );

        console.log(`🔧 Function calls found: ${functionCalls.length}`);

        if (functionCalls.length === 0) {
          console.log("✅ No further tool calls — checking for final message.");

          const assistantMessages = response.output.filter((item: any) => item.type === 'message');

          const finalText = assistantMessages
            .map((msg: any) => {
              const contentArr = msg.content ?? [];
              return contentArr
                .filter((c: any) => c.type === 'output_text')
                .map((c: any) => c.text)
                .join('');
            })
            .join('\n');

          if (finalText) {
            console.log('💬 Final response extracted:', finalText.substring(0, 100));

            return {
              summary: finalText,
              toolCallsMade,
              conversationContext
            };
          }

          console.log('⚠️  Only reasoning found, no message - continuing loop...');
        }

        for (const call of functionCalls) {
          toolCallsMade++;
          const typedCall = call as any;
          console.log(`\n⚙️  Executing tool ${toolCallsMade}: ${typedCall.name}`);

          try {
            
            let args = {};
            if (typedCall.arguments && typedCall.arguments.trim() !== '') {
              try {
                args = JSON.parse(typedCall.arguments);
              } catch (parseError) {
                console.error(`⚠️  Failed to parse arguments: "${typedCall.arguments}"`);
                args = {};
              }
            }

            const result = await executeToolCall(typedCall.name, args, userId, sessionId);

            console.log(`✅ Tool result:`, result);

            conversationContext.push({
              type: "function_call_output",
              call_id: typedCall.call_id,
              output: JSON.stringify(result)
            });
          } catch (error) {
            console.error(`❌ Tool execution failed:`, error);

            conversationContext.push({
              type: "function_call_output",
              call_id: typedCall.call_id,
              output: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            });
          }
        }

      } catch (error) {
        console.error('❌ Chat iteration error:', error);

        return {
          summary: "I encountered an error processing your request. Please try again.",
          toolCallsMade,
          conversationContext
        };
      }
    }

    console.warn('⚠️  Max iterations reached');
    return {
      summary: "I've processed your information. What else can I help with?",
      toolCallsMade,
      conversationContext
    };
  }

  static async *chatStream(
    message: string,
    chatHistory: Array<{ role: string; content: string }> = [],
    userId: string,
    sessionId: string
  ): AsyncGenerator<StreamEvent> {
    console.log('💬 FrankAI Tools Chat (Streaming):', { message, userId, sessionId });

    let conversationContext: any[] = [
      ...chatHistory,
      { role: "user", content: message }
    ];

    let toolCallsMade = 0;
    const maxIterations = 10;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      console.log(`\n🔄 Iteration ${iteration}/${maxIterations}`);

      try {
        
        yield {
          type: 'status',
          message: iteration === 1 ? 'Checking your profile...' : 'Processing...'
        };

        const stream = await openai.responses.create({
          model: "gpt-5",
          reasoning: { effort: "high" },
          instructions: this.getSystemPromptWithTools(),
          input: conversationContext,
          tools: allTools as any,
          max_output_tokens: 800,
          store: true,
          stream: true
        } as any);

        let currentText = '';
        let responseOutput: any[] = [];
        let functionCalls: any[] = [];

        for await (const event of stream as any) {
          if (event.type === 'response.output_item.added') {
            responseOutput.push(event.item);
          } else if (event.type === 'response.output_text.delta') {
            const delta = event.delta || '';
            currentText += delta;

            yield {
              type: 'text_delta',
              delta
            };
          } else if (event.type === 'response.function_call.added') {
            functionCalls.push(event.call);
          } else if (event.type === 'response.done') {
            responseOutput = event.response.output;
          }
        }

        console.log('📤 Model response:', {
          outputItems: responseOutput.length,
          types: responseOutput.map((item: any) => item.type)
        });

        const filteredOutput = responseOutput.filter((item: any, i: number, arr: any[]) => {
          
          if (item.type !== 'reasoning') return true;

          if (i + 1 < arr.length && arr[i + 1].type === 'function_call') return true;

          console.log('⚠️  Filtering out orphaned reasoning item');
          return false; 
        });

        conversationContext = [...conversationContext, ...filteredOutput];

        const calls = responseOutput.filter((item: any) => item.type === 'function_call');

        console.log(`🔧 Function calls found: ${calls.length}`);

        if (calls.length === 0) {
          console.log("✅ No further tool calls — checking for final message.");

          if (currentText) {
            console.log('💬 Final response streamed:', currentText.substring(0, 100));

            yield {
              type: 'done',
              toolCallsMade,
              conversationContext
            };
            return;
          }

          const assistantMessages = responseOutput.filter((item: any) => item.type === 'message');

          const finalText = assistantMessages
            .map((msg: any) => {
              const contentArr = msg.content ?? [];
              return contentArr
                .filter((c: any) => c.type === 'output_text')
                .map((c: any) => c.text)
                .join('');
            })
            .join('\n');

          if (finalText) {
            console.log('💬 Final response extracted:', finalText.substring(0, 100));

            yield {
              type: 'text_delta',
              delta: finalText
            };

            yield {
              type: 'done',
              toolCallsMade,
              conversationContext
            };
            return;
          }

          console.log('⚠️  Only reasoning found, no message - continuing loop...');
        }

        for (const call of calls) {
          toolCallsMade++;
          const typedCall = call as any;

          yield {
            type: 'tool_call',
            toolName: typedCall.name,
            toolNumber: toolCallsMade
          };

          console.log(`\n⚙️  Executing tool ${toolCallsMade}: ${typedCall.name}`);

          try {
            
            let args = {};
            if (typedCall.arguments && typedCall.arguments.trim() !== '') {
              try {
                args = JSON.parse(typedCall.arguments);
              } catch (parseError) {
                console.error(`⚠️  Failed to parse arguments: "${typedCall.arguments}"`);
                args = {};
              }
            }

            const result = await executeToolCall(typedCall.name, args, userId, sessionId);
            console.log(`✅ Tool result:`, result);

            conversationContext.push({
              type: "function_call_output",
              call_id: typedCall.call_id,
              output: JSON.stringify(result)
            });
          } catch (error) {
            console.error(`❌ Tool execution failed:`, error);

            conversationContext.push({
              type: "function_call_output",
              call_id: typedCall.call_id,
              output: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            });
          }
        }

      } catch (error) {
        console.error('❌ Chat iteration error:', error);

        yield {
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        return;
      }
    }

    yield {
      type: 'done',
      toolCallsMade,
      conversationContext
    };
  }

  static async simpleChat(message: string): Promise<string> {
    try {
      const response = await openai.responses.create({
        model: "gpt-5",
        reasoning: { effort: "low" },
        input: message,
        max_output_tokens: 200,
        store: false
      });

      return response.output_text || "I'm here to help!";
    } catch (error) {
      console.error('❌ Simple chat error:', error);
      return "Sorry, I encountered an error. Please try again.";
    }
  }
}

export type StreamEvent =
  | { type: 'status'; message: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call'; toolName: string; toolNumber: number }
  | { type: 'done'; toolCallsMade: number; conversationContext: any[] }
  | { type: 'error'; error: string };
