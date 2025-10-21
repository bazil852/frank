import { NextRequest } from 'next/server';
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

    console.log('🚀 Chat Tools Stream API called:', {
      message: message?.substring(0, 100),
      historyLength: chatHistory.length,
      userId,
      sessionId
    });

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!userId || !sessionId) {
      return new Response(
        JSON.stringify({ error: 'userId and sessionId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const conversationItems: any[] = [
      { role: "developer", content: SYSTEM_PROMPT },
      ...chatHistory,
      { role: "user", content: message }
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await processConversation(conversationItems, controller, encoder, userId, sessionId);
        } catch (error) {
          console.error('❌ Stream error:', error);
          const errorEvent = {
            event: 'error',
            data: { error: error instanceof Error ? error.message : 'Unknown error' }
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('❌ Chat Tools Stream API error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function processConversation(
  conversationItems: any[],
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  userId: string,
  sessionId: string,
  maxIterations = 10
) {
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    console.log(`\n🔄 Iteration ${iteration}/${maxIterations}`);

    try {
      
      const events = await openai.responses.create({
        model: "gpt-5",
        input: conversationItems,
        tools: allTools as any,
        stream: true,
        parallel_tool_calls: false,
        store: true,
      } as any);

      let currentText = '';
      let responseOutput: any[] = [];
      let hasFunctionCalls = false;

      for await (const event of events as any) {
        
        const data = JSON.stringify({
          event: event.type,
          data: event,
        });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));

        if (event.type === 'response.output_item.added') {
          responseOutput.push(event.item);
          if (event.item?.type === 'function_call') {
            hasFunctionCalls = true;
          }
        } else if (event.type === 'response.output_text.delta') {
          const delta = event.delta || '';
          currentText += delta;
          console.log('📝 Text delta received:', delta.substring(0, 50), 'Total length:', currentText.length);
        } else if (event.type === 'response.done') {
          responseOutput = event.response?.output || responseOutput;
          console.log('✅ Response done event received');
        }
      }

      console.log('📤 Response items:', {
        count: responseOutput.length,
        types: responseOutput.map((item: any) => item.type),
        hasText: currentText.length > 0,
        hasFunctionCalls,
        currentText: currentText.substring(0, 100)
      });

      const messages = responseOutput.filter((item: any) => item.type === 'message');
      if (messages.length > 0) {
        console.log('📨 Message items found:', messages.length);
        messages.forEach((msg: any, i: number) => {
          console.log(`  Message ${i}:`, {
            id: msg.id,
            contentLength: msg.content?.length,
            content: msg.content
          });
        });
      }

      const filteredOutput = responseOutput.filter((item: any, i: number, arr: any[]) => {
        if (item.type !== 'reasoning') return true;
        if (i + 1 < arr.length && arr[i + 1].type === 'function_call') return true;
        console.log('⚠️  Filtering out orphaned reasoning item');
        return false;
      });

      conversationItems = [...conversationItems, ...filteredOutput];

      const functionCalls = responseOutput.filter((item: any) => item.type === 'function_call');

      if (functionCalls.length === 0) {
        console.log('✅ No more function calls - checking for final message');

        if (currentText && currentText.trim().length > 0) {
          console.log('💬 Text was streamed:', currentText.substring(0, 100));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'done' })}\n\n`));
          controller.close();
          return;
        }

        const assistantMessages = responseOutput.filter((item: any) => item.type === 'message');
        const extractedText = assistantMessages
          .map((msg: any) => {
            const contentArr = msg.content ?? [];
            return contentArr
              .filter((c: any) => c.type === 'output_text')
              .map((c: any) => c.text)
              .join('');
          })
          .join('\n');

        if (extractedText && extractedText.trim().length > 0) {
          console.log('💬 Extracted final text:', extractedText.substring(0, 100));
          
          const textData = JSON.stringify({
            event: 'response.output_text.delta',
            data: { delta: extractedText }
          });
          controller.enqueue(encoder.encode(`data: ${textData}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'done' })}\n\n`));
          controller.close();
          return;
        }

        console.log('⚠️  No text found - continuing loop to prompt model for response...');
      }

      for (const call of functionCalls) {
        const typedCall = call as any; 
        console.log(`\n⚙️  Executing tool: ${typedCall.name}`);

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

    } catch (error) {
      console.error('❌ Iteration error:', error);
      throw error;
    }
  }

  console.warn('⚠️  Max iterations reached');
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'done' })}\n\n`));
  controller.close();
}
