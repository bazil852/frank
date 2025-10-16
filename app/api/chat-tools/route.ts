import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { allTools } from '@/lib/tools';
import { executeToolCall } from '@/lib/tools/executor';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are Frank — SA funding matcher. Sharp, helpful, conversational.

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

**EXAMPLE:**
User: "construction, 5 years trading, 100k turnover, need 1 million"

Your actions:
1. get_business_profile() → empty
2. update_business_profile({industry: "Construction", yearsTrading: 5, monthlyTurnover: 100000, amountRequested: 1000000})
3. search_lenders(useCurrentProfile: true) → 8 lenders found
4. **Write response:** "Great! I've found 8 lenders for your construction business..."

**YOUR TOOLS:**
- get_business_profile: Check existing data (call FIRST every time)
- update_business_profile: Save extracted data (call IMMEDIATELY after extraction)
- search_lenders: Find matches (call when you have 4+ fields)
- validate_province: Validate SA provinces
- get_lender_requirements: Get lender details
- calculate_eligibility: Check eligibility

**FORMATTING GUIDELINES:**
- Use **bold** for emphasis on important points (lender names, amounts, key requirements)
- Use bullet points (-) for lists of lenders or requirements
- Use numbered lists (1., 2., 3.) for step-by-step instructions
- Keep paragraphs concise and scannable
- Add line breaks between sections for readability

**CRITICAL:**
- ALWAYS call get_business_profile() first
- ALWAYS extract data from user messages
- ALWAYS call update_business_profile() when you extract anything
- **ALWAYS WRITE A TEXT RESPONSE TO THE USER** (never stop at reasoning/tools)
- Be conversational and helpful
- Format your response with markdown for better readability`;

export async function POST(request: NextRequest) {
  try {
    const { message, chatHistory = [], userId, sessionId } = await request.json();

    console.log('🚀 Chat Tools API called:', {
      message: message?.substring(0, 100),
      historyLength: chatHistory.length,
      userId,
      sessionId,
      hasApiKey: !!(process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY)
    });

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY && !process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not configured');
      return NextResponse.json(
        {
          summary: 'OpenAI API key is not configured. Please add OPENAI_API_KEY to environment variables.',
          toolCallsMade: 0,
          success: false,
          error: 'OPENAI_API_KEY not configured'
        },
        { status: 500 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!userId || !sessionId) {
      return NextResponse.json(
        { error: 'userId and sessionId are required' },
        { status: 400 }
      );
    }

    // Build conversation context
    const conversationItems: any[] = [
      { role: "developer", content: SYSTEM_PROMPT },
      ...chatHistory,
      { role: "user", content: message }
    ];

    // Process conversation with tool calling loop
    const result = await processConversation(conversationItems, userId, sessionId);

    console.log('✅ Chat Tools API response:', {
      summaryLength: result.summary.length,
      toolCallsMade: result.toolCallsMade,
    });

    return NextResponse.json({
      summary: result.summary,
      toolCallsMade: result.toolCallsMade,
      success: true
    });
  } catch (error) {
    console.error('❌ Chat Tools API error:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });

    return NextResponse.json(
      {
        summary: 'Sorry, I encountered an error processing your request.',
        toolCallsMade: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function processConversation(
  conversationItems: any[],
  userId: string,
  sessionId: string,
  maxIterations = 10
): Promise<{ summary: string; toolCallsMade: number }> {
  let iteration = 0;
  let toolCallsMade = 0;
  let finalMessage = '';

  while (iteration < maxIterations) {
    iteration++;
    console.log(`\n🔄 Iteration ${iteration}/${maxIterations}`);

    try {
      console.log(`🔧 [Iteration ${iteration}] Calling OpenAI with ${conversationItems.length} items`);

      // Call OpenAI without streaming
      const response = await openai.responses.create({
        model: "gpt-5",
        input: conversationItems,
        tools: allTools as any,
        parallel_tool_calls: false,
        store: true,
      } as any).catch((err: any) => {
        console.error('❌ OpenAI API call failed:', {
          error: err.message,
          status: err.status,
          code: err.code,
          type: err.type
        });
        throw err;
      });

      console.log('📤 Model response:', {
        outputItems: response.output?.length,
        types: response.output?.map((item: any) => item.type)
      });

      // Filter and add to context (remove orphaned reasoning)
      const filteredOutput = response.output.filter((item: any, i: number, arr: any[]) => {
        if (item.type !== 'reasoning') return true;
        if (i + 1 < arr.length && arr[i + 1].type === 'function_call') return true;
        console.log('⚠️  Filtering out orphaned reasoning item');
        return false;
      });

      conversationItems = [...conversationItems, ...filteredOutput];

      // Find function calls
      const functionCalls = response.output.filter((item: any) => item.type === 'function_call');

      console.log(`🔧 Function calls found: ${functionCalls.length}`);

      // If no function calls, extract final message
      if (functionCalls.length === 0) {
        console.log("✅ No further tool calls — extracting final message.");

        // Extract text from message items
        const assistantMessages = response.output.filter((item: any) => item.type === 'message');

        finalMessage = assistantMessages
          .map((msg: any) => {
            const contentArr = msg.content ?? [];
            return contentArr
              .filter((c: any) => c.type === 'output_text')
              .map((c: any) => c.text)
              .join('');
          })
          .join('\n');

        if (finalMessage) {
          console.log('💬 Final response extracted:', finalMessage.substring(0, 100));
          return { summary: finalMessage, toolCallsMade };
        }

        // If no text (only reasoning), continue loop
        console.log('⚠️  Only reasoning found, no message - continuing loop...');
      }

      // Execute all function calls
      for (const call of functionCalls) {
        toolCallsMade++;
        const typedCall = call as any; // Type cast for SDK compatibility
        console.log(`\n⚙️  Executing tool ${toolCallsMade}: ${typedCall.name}`);

        try {
          let args = {};
          if (typedCall.arguments && typedCall.arguments.trim() !== '') {
            try {
              args = JSON.parse(typedCall.arguments);
            } catch (parseError) {
              console.error(`⚠️  Failed to parse arguments: "${typedCall.arguments}"`);
            }
          }

          const result = await executeToolCall(typedCall.name, args, userId, sessionId);
          console.log(`✅ Tool result:`, result);

          // Add function result to context
          conversationItems.push({
            type: "function_call_output",
            call_id: typedCall.call_id,
            output: JSON.stringify(result)
          });
        } catch (error) {
          console.error(`❌ Tool execution failed:`, error);

          conversationItems.push({
            type: "function_call_output",
            call_id: typedCall.call_id,
            output: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          });
        }
      }

      // Continue loop to get model's next response
    } catch (error) {
      console.error('❌ Chat iteration error:', error);
      console.error('❌ Iteration error details:', {
        iteration,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        conversationLength: conversationItems.length
      });

      throw error; // Re-throw to be caught by outer try-catch for better error reporting
    }
  }

  // Max iterations reached
  console.warn('⚠️  Max iterations reached');
  return {
    summary: finalMessage || "I've processed your information. What else can I help with?",
    toolCallsMade
  };
}
