import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, chatHistory = [], userId, sessionId } = await req.json()

    console.log('🚀 Chat Tools Function called:', {
      message: message?.substring(0, 100),
      historyLength: chatHistory.length,
      userId,
      sessionId
    })

    // Check required fields
    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!userId || !sessionId) {
      return new Response(
        JSON.stringify({ error: 'userId and sessionId are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check OpenAI API key
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-5'

    // Import tools dynamically (we'll need to copy these)
    const tools = getTools()

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
- Format your response with markdown for better readability`

    // Build conversation context
    const conversationItems = [
      { role: 'developer', content: SYSTEM_PROMPT },
      ...chatHistory,
      { role: 'user', content: message }
    ]

    // Process conversation with OpenAI
    const result = await processConversation(
      conversationItems,
      userId,
      sessionId,
      OPENAI_API_KEY,
      MODEL,
      tools
    )

    console.log('✅ Response:', {
      summaryLength: result.summary.length,
      toolCallsMade: result.toolCallsMade
    })

    return new Response(
      JSON.stringify({
        summary: result.summary,
        toolCallsMade: result.toolCallsMade,
        success: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('❌ Error:', error)

    return new Response(
      JSON.stringify({
        summary: 'Sorry, I encountered an error processing your request.',
        toolCallsMade: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function processConversation(
  conversationItems: any[],
  userId: string,
  sessionId: string,
  apiKey: string,
  model: string,
  tools: any[],
  maxIterations = 10 // Supabase allows 150s timeout!
): Promise<{ summary: string; toolCallsMade: number }> {
  const startTime = Date.now()
  let iteration = 0
  let toolCallsMade = 0
  let finalMessage = ''

  while (iteration < maxIterations) {
    iteration++
    const elapsed = Date.now() - startTime

    console.log(`\n🔄 Iteration ${iteration}/${maxIterations} (${elapsed}ms elapsed)`)

    try {
      // Call OpenAI Responses API
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          input: conversationItems,
          tools,
          parallel_tool_calls: false,
          store: true
        })
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('❌ OpenAI API error:', error)
        throw new Error(`OpenAI API error: ${response.status} - ${error}`)
      }

      const data = await response.json()

      console.log('📤 Model response:', {
        outputItems: data.output?.length,
        types: data.output?.map((item: any) => item.type)
      })

      // Filter orphaned reasoning
      const filteredOutput = data.output.filter((item: any, i: number, arr: any[]) => {
        if (item.type !== 'reasoning') return true
        if (i + 1 < arr.length && arr[i + 1].type === 'function_call') return true
        return false
      })

      conversationItems = [...conversationItems, ...filteredOutput]

      // Find function calls
      const functionCalls = data.output.filter((item: any) => item.type === 'function_call')

      // If no function calls, extract final message
      if (functionCalls.length === 0) {
        const assistantMessages = data.output.filter((item: any) => item.type === 'message')

        finalMessage = assistantMessages
          .map((msg: any) => {
            const contentArr = msg.content ?? []
            return contentArr
              .filter((c: any) => c.type === 'output_text')
              .map((c: any) => c.text)
              .join('')
          })
          .join('\n')

        if (finalMessage) {
          console.log('💬 Final response:', finalMessage.substring(0, 100))
          return { summary: finalMessage, toolCallsMade }
        }
      }

      // Execute function calls
      for (const call of functionCalls) {
        toolCallsMade++
        console.log(`\n⚙️  Executing tool ${toolCallsMade}: ${call.name}`)

        try {
          let args = {}
          if (call.arguments && call.arguments.trim() !== '') {
            args = JSON.parse(call.arguments)
          }

          const result = await executeToolCall(call.name, args, userId, sessionId)
          console.log('✅ Tool result:', result)

          conversationItems.push({
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify(result)
          })
        } catch (error) {
          console.error('❌ Tool execution failed:', error)

          conversationItems.push({
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          })
        }
      }
    } catch (error) {
      console.error('❌ Iteration error:', error)
      throw error
    }
  }

  return {
    summary: finalMessage || "I've processed your information. What else can I help with?",
    toolCallsMade
  }
}

// Tool definitions
function getTools() {
  return [
    {
      type: 'function',
      function: {
        name: 'get_business_profile',
        description: 'Retrieve the current business profile for a user',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'update_business_profile',
        description: 'Update business profile with extracted information',
        parameters: {
          type: 'object',
          properties: {
            industry: { type: 'string', description: 'Business industry' },
            yearsTrading: { type: 'number', description: 'Years in business' },
            monthlyTurnover: { type: 'number', description: 'Monthly turnover in Rands' },
            amountRequested: { type: 'number', description: 'Funding amount requested' },
            useOfFunds: { type: 'string', description: 'How funds will be used' },
            urgencyDays: { type: 'number', description: 'Urgency in days' },
            province: { type: 'string', description: 'SA province' },
            vatRegistered: { type: 'boolean', description: 'VAT registration status' },
            saRegistered: { type: 'boolean', description: 'SA company registration' },
            saDirector: { type: 'boolean', description: 'Has SA director' },
            bankStatements: { type: 'boolean', description: 'Has bank statements' },
            collateralAcceptable: { type: 'boolean', description: 'Collateral available' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_lenders',
        description: 'Search for matching lenders based on profile',
        parameters: {
          type: 'object',
          properties: {
            useCurrentProfile: { type: 'boolean', description: 'Use stored profile' }
          }
        }
      }
    }
  ]
}

// Tool executor
async function executeToolCall(
  name: string,
  args: any,
  userId: string,
  sessionId: string
): Promise<any> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  console.log(`🔧 Executing tool: ${name}`, { args, userId, sessionId })

  switch (name) {
    case 'get_business_profile': {
      const { data, error } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('DB error:', error)
        return { success: false, profile: {}, message: 'Database error' }
      }

      return { success: true, profile: data?.profile_data || {}, message: data ? 'Profile found' : 'No existing profile found' }
    }

    case 'update_business_profile': {
      const { error } = await supabase
        .from('business_profiles')
        .upsert({
          user_id: userId,
          profile_data: args,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (error) {
        console.error('DB error:', error)
        return { success: false, message: 'Failed to update profile' }
      }

      return { success: true, message: 'Profile updated', fieldsUpdated: Object.keys(args) }
    }

    case 'search_lenders': {
      // Simplified - return mock data or query lenders table
      const { data: lenders } = await supabase
        .from('lenders')
        .select('*')
        .limit(20)

      return {
        success: true,
        lendersFound: lenders?.length || 0,
        lenders: lenders?.map(l => ({ id: l.id, provider: l.provider })) || []
      }
    }

    default:
      return { success: false, error: `Unknown tool: ${name}` }
  }
}
