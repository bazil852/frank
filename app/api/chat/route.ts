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

    const completion = await openai.responses.create({
      model: 'gpt-5',
      reasoning: { effort: "low" },
      instructions: 'You are Frank — short, helpful, SA context, no fluff. Return only valid JSON.',
      input: prompt,
      max_output_tokens: 150,
      stream: true,
      store: false
    });

    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of completion) {
            if (event.type === 'response.output_item.added') {
              continue;
            }

            if (event.type === 'response.output_text.delta') {
              const content = event.delta || '';
              fullResponse += content;

              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
            }
          }

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
  const lower = message.toLowerCase();

  const amountRegex = /r?\s*(\d+(?:[.,]\d+)?|\d{1,3}(?:[.,]\d{3})*)\s*([km])?/gi;
  const matches = Array.from(message.matchAll(amountRegex));
  let computedTurnover: number | null = null;
  let computedNeed: number | null = null;
  for (const m of matches) {
    const raw = (m[1] || '').replace(/,/g, '');
    const suffix = (m[2] || '').toLowerCase();
    let num = parseFloat(raw);
    if (isNaN(num)) continue;
    if (suffix === 'k') num *= 1_000;
    if (suffix === 'm') num *= 1_000_000;
    const amount = Math.round(num);
    if (amount <= 1000 || amount >= 100_000_000) continue;

    const idx = m.index ?? 0;
    const lookback = 30;
    const before = lower.slice(Math.max(0, idx - lookback), idx);
    const after = lower.slice(idx, Math.min(lower.length, idx + 30));
    const lastTurnoverIdx = before.lastIndexOf('turnover');
    const lastRevenueIdx = before.lastIndexOf('revenue');
    const lastMonthlyIdx = before.lastIndexOf('monthly');
    const lastPerMonthIdx = before.lastIndexOf('per month');
    const lastNeedIdx = before.lastIndexOf('need');
    const lastLoanIdx = before.lastIndexOf('loan');
    const lastFundIdx = before.lastIndexOf('fund');
    const lastFundingIdx = before.lastIndexOf('funding');
    const lastFinanceIdx = before.lastIndexOf('finance');
    const lastBorrowIdx = before.lastIndexOf('borrow');
    const lastApplyIdx = before.lastIndexOf('apply');

    const turnoverCue = Math.max(lastTurnoverIdx, lastRevenueIdx, lastMonthlyIdx, lastPerMonthIdx);
    const needCue = Math.max(lastNeedIdx, lastLoanIdx, lastFundIdx, lastFundingIdx, lastFinanceIdx, lastBorrowIdx, lastApplyIdx);

    if (needCue >= 0 && (turnoverCue < 0 || needCue >= turnoverCue)) {
      computedNeed = amount;
    } else if (turnoverCue >= 0) {
      computedTurnover = amount;
    } else {
      const isTurnoverAfter = /turnover|revenue|monthly|per\s*month/.test(after);
      const isNeedAfter = /need|loan|fund|funding|finance|borrow|apply/.test(after);
      if (isNeedAfter) computedNeed = amount;
      else if (isTurnoverAfter) computedTurnover = amount;
    }
  }

  if (computedTurnover !== null) {
    result.monthlyTurnover = computedTurnover;
  }
  if (computedNeed !== null) {
    result.amountRequested = computedNeed;
  }

  const daysMatch = message.match(/(\d+)\s*days?/i);
  if (daysMatch) {
    result.urgencyDays = parseInt(daysMatch[1]);
  } else if (/\basap\b|as soon as possible/i.test(message)) {
    result.urgencyDays = 3;
  }

  if (result.vatRegistered === undefined) {
    const negVat = /(not\s+(yet\s+)?vat[-\s]?registered|no\s+vat\b|not\s+registered\s+for\s+vat|without\s+vat|non-?vat)/i;
    const posVat = /(\bvat[-\s]?registered\b|registered\s+for\s+vat|vat\s+reg(istration)?\b|vat\s+number)/i;
    if (negVat.test(lower)) result.vatRegistered = false;
    else if (posVat.test(lower)) result.vatRegistered = true;
  }

  const industries = ['Retail', 'Services', 'Manufacturing', 'Hospitality', 'Logistics', 'Construction', 'Technology', 'Healthcare'];
  for (const industry of industries) {
    if (lower.includes(industry.toLowerCase())) {
      result.industry = industry;
      break;
    }
  }

  const provinces = ['Gauteng','Western Cape','KwaZulu-Natal','KZN','Eastern Cape','Free State','North West','Limpopo','Mpumalanga','Northern Cape'];
  for (const p of provinces) {
    const re = new RegExp(`\\b${p.replace(/[-]/g, '[- ]')}\\b`, 'i');
    if (re.test(message)) {
      result.province = p === 'KZN' ? 'KZN' : p;
      break;
    }
  }

  const yearsMatch = message.match(/(\d+)\s*years?/i);
  if (yearsMatch) result.yearsTrading = parseInt(yearsMatch[1]);

  return result;
}