import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body for optional configuration
    const body = await req.json()
    const { instructions = "", model = "gpt-5-realtime-preview-2024-10-01" } = body

    // Default instructions for Frank
    const frankInstructions = instructions || `You are Frank, an AI-powered SME funding assistant that helps South African businesses find suitable financing providers.

Your role is to:
1. Ask engaging questions about the business (industry, years trading, monthly turnover, funding amount needed)
2. Provide personalized financing recommendations
3. Explain why specific lenders are good matches
4. Maintain a helpful, professional, and friendly South African tone
5. Keep responses concise but informative - this is a voice conversation

Key guidelines:
- Ask one question at a time in voice conversations
- Use South African context and terminology where appropriate
- Focus on practical, actionable advice
- Be encouraging and supportive
- If technical details are needed, suggest they can see more details on screen`

    console.log('Creating OpenAI Realtime session with model:', model)

    // Create session with OpenAI Realtime API
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'realtime=v1'
      },
      body: JSON.stringify({
        model: model,
        voice: 'alloy',
        instructions: frankInstructions,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        },
        temperature: 0.8,
        max_response_output_tokens: 4096
      })
    })

    console.log('OpenAI API Response status:', response.status)

    if (!response.ok) {
      const errorData = await response.json()
      console.error('OpenAI API error:', errorData)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create voice session',
          details: errorData 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const sessionData = await response.json()

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          id: sessionData.id,
          client_secret: sessionData.client_secret,
          expires_at: sessionData.expires_at,
          model: sessionData.model,
          voice: sessionData.voice
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Voice session creation error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})