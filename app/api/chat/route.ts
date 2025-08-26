import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { Profile } from '@/lib/filters';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const { message, profile } = await request.json();
    
    console.log('Chat stream API called with:', { message, profile });

    if (!process.env.OPENAI_API_KEY) {
      console.log('No OpenAI API key found, using fallback');
      return new Response(
        JSON.stringify({ summary: 'Got it — I\'ll tune your matches based on your needs', extracted: parseExtracted({}, message || '') }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `User said: "${message}". Provide a friendly summary (max 30 words) acknowledging their business needs. Also extract any obvious business fields from their message: numbers might be ZAR amounts/turnover/days, "VAT" means vat_registered=true, common SA sectors map to industry. 

IMPORTANT: Return ONLY valid JSON without markdown formatting or code blocks. Example:
{"summary": "Got it, looking for R500k for your retail business.", "extracted": {"industry": "Retail", "amountRequested": 500000}}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are Frank — short, helpful, SA context, no fluff. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 150,
      stream: true,
    });

    const encoder = new TextEncoder();
    let fullResponse = '';
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || '';
            fullResponse += content;
            
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          
          // Process the complete response for entity extraction
          try {
            let cleanResponse = fullResponse.trim();
            if (cleanResponse.startsWith('```json') && cleanResponse.endsWith('```')) {
              cleanResponse = cleanResponse.slice(7, -3).trim();
            } else if (cleanResponse.startsWith('```') && cleanResponse.endsWith('```')) {
              cleanResponse = cleanResponse.slice(3, -3).trim();
            }
            
            const parsed = JSON.parse(cleanResponse);
            const extracted = parseExtracted(parsed.extracted || {}, message);
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              done: true, 
              summary: parsed.summary || fullResponse,
              extracted 
            })}\n\n`));
          } catch (error) {
            console.error('Failed to parse final response:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              done: true, 
              summary: fullResponse,
              extracted: parseExtracted({}, message)
            })}\n\n`));
          }
          
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat stream API error:', error);
    return new Response(
      JSON.stringify({ 
        summary: 'Got it — I\'ll tune your matches based on your needs',
        extracted: {}
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function parseExtracted(extracted: any, message: string): Partial<Profile> {
  const result: Partial<Profile> = { ...extracted };
  
  const amountMatch = message.match(/R?\s*(\d+)k|\b(\d{4,})\b/i);
  if (amountMatch) {
    const amount = amountMatch[1] ? parseInt(amountMatch[1]) * 1000 : parseInt(amountMatch[2]);
    if (amount > 10000 && amount < 100000000) {
      if (message.toLowerCase().includes('need') || message.toLowerCase().includes('loan') || message.toLowerCase().includes('finance')) {
        result.amountRequested = amount;
      } else if (message.toLowerCase().includes('turnover') || message.toLowerCase().includes('revenue')) {
        result.monthlyTurnover = amount;
      }
    }
  }

  const daysMatch = message.match(/(\d+)\s*days?/i);
  if (daysMatch) {
    result.urgencyDays = parseInt(daysMatch[1]);
  }

  if (message.toLowerCase().includes('vat')) {
    result.vatRegistered = true;
  }

  const industries = ['Retail', 'Services', 'Manufacturing', 'Hospitality', 'Logistics'];
  industries.forEach(industry => {
    if (message.toLowerCase().includes(industry.toLowerCase())) {
      result.industry = industry;
    }
  });

  const yearsMatch = message.match(/(\d+)\s*years?/i);
  if (yearsMatch) {
    result.yearsTrading = parseInt(yearsMatch[1]);
  }

  return result;
}