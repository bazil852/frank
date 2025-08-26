import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Profile } from '@/lib/filters';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const { message, profile, productNotes, chatHistory = [], personality } = await request.json();
    
    console.log('GPT API called with:', { message, profile, productNotes });
    console.log('API Key exists:', !!process.env.OPENAI_API_KEY);

    if (!process.env.OPENAI_API_KEY) {
      console.log('No OpenAI API key found, using fallback');
      return NextResponse.json({
        rationale: productNotes ? 'Good fit for your business profile' : undefined,
        summary: message ? 'Got it — I\'ll tune your matches based on your needs' : undefined,
        extracted: parseExtracted({}, message || '')
      });
    }

    // Base system prompt with personality overlay
    const baseSystemPrompt = `You are Frank — an assistant who helps SA SMEs find funding matches. You explain clearly why options fit or not, use ZAR, never invent providers.

Your job is MATCHING, not vetting:
- You match SME inputs (industry, years trading, monthly turnover, VAT status, amount needed, use of funds, urgency days, province) against a static catalog of funding products.
- You are NOT a credit checker, document parser, or affordability assessor. You just filter catalog rules.
- Answer questions about specific lenders using catalog data (requirements, amounts, speed, etc.).
- Collect the 8 key inputs needed for matching: industry, years trading, monthly turnover, VAT registered (yes/no), amount, use of funds, urgency (days), province.
- Keep asking follow-up questions to get missing details.
- Only reference providers from the catalog. Never invent or hallucinate lenders.`;

    // Add personality if provided
    const personalityPrompt = personality 
      ? `\n\nIMPORTANT PERSONALITY INSTRUCTION: ${personality}\n\nYou MUST strictly adhere to this personality style in all your responses while maintaining accuracy and helpfulness.`
      : '\n\nBe professional, friendly, and direct. Use a warm but business-like tone.';
      
    const systemPrompt = baseSystemPrompt + personalityPrompt;

    let prompt = '';

    if (productNotes) {
      prompt = `Given this business profile: ${JSON.stringify(profile)} and these product notes: "${productNotes}", provide a single bullet point rationale (max 18 words) for why this is a good match.`;
    } else if (message) {
      const catalogData = `
Available Lenders:
- Lulalend: R20k-R2m, 1+ years trading, R50k+ monthly turnover, 2-3 days, Gauteng/WC/KZN only
- Bridgement: R250k-R1m, 2+ years trading, R200k+ monthly turnover, VAT required, 3-5 days
- Merchant Capital: R50k-R5m, 1+ years trading, R100k+ monthly turnover, 1-2 days (MCA)
- Retail Capital: R100k-R10m, 3+ years trading, R500k+ monthly turnover, VAT required, 5-7 days, excludes hospitality
- Fundrr: R50k-R500k, 2+ years trading, R150k+ monthly turnover, VAT required, 3-5 days
- Grobank: R1m-R50m, 5+ years trading, R2m+ monthly turnover, VAT required, collateral required, 14-21 days
- PayFast Capital: R30k-R300k, 1+ years trading, R80k+ monthly turnover, 1-2 days, Gauteng/WC only (MCA)
- Business Partners: R500k-R15m, 3+ years trading, R800k+ monthly turnover, VAT required, 21-30 days
- Spark Capital: R500k-R20m, 5+ years trading, R1m+ monthly turnover, VAT required, collateral required, 10-14 days (Asset Finance)
- Finclusion: R100k-R750k, 2+ years trading, R250k+ monthly turnover, 5-7 days, excludes retail
      `;
      
      prompt = `User said: "${message}". 

Here's the lender catalog for reference:
${catalogData}

If they're asking about a specific lender, answer their question using the catalog data above, then ask what they need.
Otherwise, provide a summary acknowledging their business needs and ask for missing info.

STYLE: Follow the personality instructions provided. Use plain text, no markdown formatting except for **bold** when appropriate. If you need to emphasize something, use CAPS or list items with numbers/bullets naturally.

Also extract any obvious business fields from their message: numbers might be ZAR amounts/turnover/days, "VAT" means vat_registered=true, common SA sectors map to industry. 

IMPORTANT: Return ONLY valid JSON without markdown formatting or code blocks. Example:
{"summary": "Lulalend is pretty flexible - R20k to R2m, just need 1 year trading and R50k monthly turnover. How much do you need?", "extracted": {"industry": "Retail", "amountRequested": 500000}}`;
    }

    console.log('Sending to OpenAI with prompt:', prompt);
    
    // Build messages array with conversation history
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.slice(-20), // Keep last 20 messages for better context
      { role: 'user', content: message }
    ];
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 500, // Increased from 150 to 500 for fuller responses
    });

    const response = completion.choices[0]?.message?.content || '';
    
    console.log('OpenAI response:', response);

    if (productNotes) {
      return NextResponse.json({ rationale: response });
    } else if (message) {
      try {
        // Clean response of any markdown formatting
        let cleanResponse = response.trim();
        if (cleanResponse.startsWith('```json') && cleanResponse.endsWith('```')) {
          cleanResponse = cleanResponse.slice(7, -3).trim();
        } else if (cleanResponse.startsWith('```') && cleanResponse.endsWith('```')) {
          cleanResponse = cleanResponse.slice(3, -3).trim();
        }
        
        const parsed = JSON.parse(cleanResponse);
        const extractedData = parseExtracted(parsed.extracted || {}, message);
        console.log('Extracted data being returned:', extractedData);
        return NextResponse.json({
          summary: parsed.summary || 'Got it — I\'ll tune your matches based on your needs',
          extracted: extractedData
        });
      } catch (error) {
        console.error('Failed to parse GPT response:', error);
        return NextResponse.json({
          summary: response || 'Got it — I\'ll tune your matches based on your needs',
          extracted: parseExtracted({}, message)
        });
      }
    }

    return NextResponse.json({});
  } catch (error) {
    console.error('GPT API error:', error);
    return NextResponse.json({
      rationale: 'Good fit for your business profile',
      summary: 'Got it — I\'ll tune your matches based on your needs',
      extracted: {}
    });
  }
}

function parseExtracted(extracted: any, message: string): Partial<Profile> {
  const result: Partial<Profile> = {};
  
  // First, use the GPT extracted values
  if (extracted) {
    // Ensure proper type conversion for numeric fields
    if (extracted.amountRequested) {
      result.amountRequested = typeof extracted.amountRequested === 'string' 
        ? parseInt(extracted.amountRequested.replace(/[^0-9]/g, ''))
        : extracted.amountRequested;
    }
    if (extracted.monthlyTurnover) {
      result.monthlyTurnover = typeof extracted.monthlyTurnover === 'string' 
        ? parseInt(extracted.monthlyTurnover.replace(/[^0-9]/g, ''))
        : extracted.monthlyTurnover;
    }
    if (extracted.yearsTrading) {
      result.yearsTrading = typeof extracted.yearsTrading === 'string' 
        ? parseInt(extracted.yearsTrading)
        : extracted.yearsTrading;
    }
    if (extracted.urgencyDays) {
      result.urgencyDays = typeof extracted.urgencyDays === 'string' 
        ? parseInt(extracted.urgencyDays)
        : extracted.urgencyDays;
    }
    if (extracted.industry) {
      result.industry = extracted.industry;
    }
    if (extracted.vatRegistered !== undefined) {
      result.vatRegistered = extracted.vatRegistered;
    }
    if (extracted.useOfFunds) {
      result.useOfFunds = extracted.useOfFunds;
    }
    if (extracted.province) {
      result.province = extracted.province;
    }
  }
  
  // Then try to extract from the message if GPT didn't catch it
  if (!result.amountRequested || !result.monthlyTurnover) {
    const amountMatch = message.match(/R?\s*(\d+)k|\b(\d{4,})\b/i);
    if (amountMatch) {
      const amount = amountMatch[1] ? parseInt(amountMatch[1]) * 1000 : parseInt(amountMatch[2]);
      if (amount > 10000 && amount < 100000000) {
        if (!result.amountRequested && (message.toLowerCase().includes('need') || message.toLowerCase().includes('loan') || message.toLowerCase().includes('finance'))) {
          result.amountRequested = amount;
        } else if (!result.monthlyTurnover && (message.toLowerCase().includes('turnover') || message.toLowerCase().includes('revenue'))) {
          result.monthlyTurnover = amount;
        }
      }
    }
  }

  if (!result.urgencyDays) {
    const daysMatch = message.match(/(\d+)\s*days?/i);
    if (daysMatch) {
      result.urgencyDays = parseInt(daysMatch[1]);
    }
  }

  if (!result.vatRegistered && message.toLowerCase().includes('vat')) {
    result.vatRegistered = true;
  }

  if (!result.industry) {
    const industries = ['Retail', 'Services', 'Manufacturing', 'Hospitality', 'Logistics'];
    industries.forEach(industry => {
      if (message.toLowerCase().includes(industry.toLowerCase())) {
        result.industry = industry;
      }
    });
  }

  if (!result.yearsTrading) {
    const yearsMatch = message.match(/(\d+)\s*years?/i);
    if (yearsMatch) {
      result.yearsTrading = parseInt(yearsMatch[1]);
    }
  }

  console.log('Final parsed extracted data:', result);
  return result;
}