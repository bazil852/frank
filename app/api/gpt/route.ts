import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Profile } from '@/lib/filters';
import { ExtractSchema } from '@/lib/ai-schemas';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const { message, profile, productNotes, chatHistory = [], personality } = await request.json();
    
    console.log('GPT API called with:', { message, profile, productNotes });
    console.log('API Key exists:', !!process.env.OPENAI_API_KEY);
    console.log('API Key first 10 chars:', process.env.OPENAI_API_KEY?.substring(0, 10));

    if (!process.env.OPENAI_API_KEY) {
      console.log('❌ NO OPENAI API KEY FOUND - USING FALLBACK');
      return NextResponse.json({
        rationale: productNotes ? 'Fast approval with competitive terms' : undefined,
        summary: message ? 'Thanks for the information! Let me process that for you.' : undefined,
        extracted: parseExtracted({}, message || '')
      });
    }

    // Base system prompt with personality overlay
    const baseSystemPrompt = `You are Frank — the shortcut to funding that actually lands. No dead ends, no 30-page forms.

PERSONALITY & TONE:
- Be human and witty with light sarcasm (always helpful though)
- Use casual, conversational language
- Make funding feel less intimidating
- Never sound robotic or formal

CONVERSATION FLOW:

0. OPENER (First message only):
"I'm Frank — the shortcut to funding that actually lands. No dead ends, no 30-page forms.
Tell me a bit about your business — how long you've been running, your turnover, and if you're registered. The more you share, the faster I can match you."

1. SMART CAPTURE & ACKNOWLEDGE:
- Parse user responses for multiple fields at once
- Store ALL information immediately (don't re-ask)
- Acknowledge what you captured: "Perfect — registered, 18 months, R1.5m turnover. You're basically prom king to lenders. Let me just fill in a couple of gaps…"

2. CORE CRITERIA (Ask ONLY if not already provided):
- "Do you run things through a South African business bank account, or is it still friends-with-benefits with your personal one?"
- "Any of the directors South African residents, or is it an all-foreign squad?"
- "Do you have at least 6 months of bank statements handy? (Lenders love them more than coffee.)"
- "How much funding are you after — a R250k top-up, a million-plus expansion, or bigger?"
- "And how fast do you need the cash — this week, or can you wait while lenders do their paper-shuffling dance?"

3. MATCH REVEAL (Once you have enough info):
"Alright, based on your info, you've got matches. These lenders look good for you — and you can apply right now. No wasting time chasing dead ends. Want me to help you apply to one, or just throw your hat in the ring with all of them? Totally normal to apply to a few and see who comes back fastest — and cheapest."

4. APPLICATION STEP (When user wants to proceed):
"All I need now:
– Your business name
– Your email
– Your phone number
That sets up your account so you can track everything. Think of it as your backstage pass to funding — minus the dodgy guest list."

Then add: "Quick heads-up while we're at it: every lender does a credit check on you and the company. If there's anything messy, it's better to mention it upfront — lenders hate surprises more than a bad punchline."

5. CONFIRMATION:
"Perfect. I've set up your account and sent your details to the lenders that fit you. They'll reach out directly. I'll also check in later — email or WhatsApp, your pick — and no, I'm not the clingy type."

CRITICAL RULES:
- NEVER re-ask for information already provided
- Store everything the user mentions, even if volunteered outside the immediate question
- Always acknowledge what you've captured
- Match against the catalog below, never invent lenders
- Track conversation state and know where you are in the flow`;

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

RESPONSE TASK:
1. If they're asking about a specific lender, answer their question using the catalog data above, then ask what they need.
2. Otherwise, provide a summary acknowledging their business needs and ask for missing info.
3. Follow Frank's personality: witty, human, helpful with light sarcasm.
4. Extract ALL business information mentioned.

EXTRACTION FIELDS:
- industry, monthlyTurnover (number), amountRequested (number), yearsTrading (number)
- vatRegistered (boolean), useOfFunds, urgencyDays (number), province
- contact: {name, email, phone}

You must respond with valid JSON only. Use this exact format:
{
  "summary": "your witty Frank response here",
  "extracted": {"field1": value1, "field2": value2}
}

For a greeting like "hey" with no business info, respond like:
{
  "summary": "Hey there! Ready to chat about your business and get that funding rolling? Tell me what you're working with — years trading, monthly turnover, industry, and how much you need. The more details, the better the matches.",
  "extracted": {}
}`;
    }

    console.log('Sending to OpenAI with prompt:', prompt);
    
    // Build messages array with conversation history, filtering out null content
    const validChatHistory = chatHistory.slice(-20).filter((msg: any) => 
      msg && msg.content && typeof msg.content === 'string' && msg.content.trim() !== ''
    );
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...validChatHistory,
      { role: 'user', content: (prompt || message || '').toString() }
    ].filter(msg => (msg as any).content && (msg as any).content.trim() !== '');
    
    const response = await openai.responses.create({
      model: 'gpt-5',
      reasoning: { effort: "low" },
      instructions: systemPrompt + personalityPrompt,
      input: (prompt || message || '').toString(),
      text: {
        format: {
          type: "json_schema",
          name: ExtractSchema.name,
          schema: ExtractSchema.schema,
          strict: false
        }
      },
      max_output_tokens: 400,
      store: false
    });

    const responseText = response.output_text || '';

    console.log('✅ OpenAI API call successful');
    console.log('📝 Raw OpenAI response:', responseText);
    console.log('📝 Response length:', responseText.length);
    console.log('📝 First 100 chars:', responseText.substring(0, 100));

    if (productNotes) {
      return NextResponse.json({ rationale: responseText });
    } else if (message) {
      try {
        // Clean response of any markdown formatting
        let cleanResponse = responseText.trim();
        if (cleanResponse.startsWith('```json') && cleanResponse.endsWith('```')) {
          cleanResponse = cleanResponse.slice(7, -3).trim();
        } else if (cleanResponse.startsWith('```') && cleanResponse.endsWith('```')) {
          cleanResponse = cleanResponse.slice(3, -3).trim();
        }

        // If response doesn't look like JSON, try to extract from fallback
        if (!cleanResponse.startsWith('{')) {
          console.warn('Response is not JSON format, using fallback extraction');
          console.warn('Raw response was:', responseText);
          console.warn('Cleaned response was:', cleanResponse);
          const extractedData = parseExtracted({}, message);
          return NextResponse.json({
            summary: 'Thanks for the information! Let me process that for you.',
            extracted: extractedData
          });
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
        console.error('Response was:', responseText);
        
        // Fallback extraction from the message directly
        const extractedData = parseExtracted({}, message);
        return NextResponse.json({
          summary: 'Thanks for the information! Let me process that for you.',
          extracted: extractedData
        });
      }
    }

    return NextResponse.json({});
  } catch (error) {
    console.error('GPT API error:', error);
    return NextResponse.json({
      rationale: 'Fast approval with competitive terms',
      summary: 'Got it — I\'ll tune your matches based on your needs',
      extracted: {}
    });
  }
}

function parseExtracted(extracted: any, message: string): Partial<Profile> {
  const result: Partial<Profile> = {};
  
  const messageLower = message.toLowerCase();
  
  // Special case: if the message contains detailed business summary, extract from it
  if (messageLower.includes('industry:') || messageLower.includes('years in business:') || messageLower.includes('monthly turnover:')) {
    // Parse structured information from the message itself
    const industryMatch = message.match(/industry:\s*([^\n•]+)/i);
    if (industryMatch) result.industry = industryMatch[1].trim();
    
    const yearsMatch = message.match(/years in business:\s*(\d+)/i);
    if (yearsMatch) result.yearsTrading = parseInt(yearsMatch[1]);
    
    const turnoverMatch = message.match(/monthly turnover:\s*R(\d{1,3}(?:,\d{3})*)/i);
    if (turnoverMatch) result.monthlyTurnover = parseInt(turnoverMatch[1].replace(/,/g, ''));
    
    const amountMatch = message.match(/funding amount needed:\s*R(\d{1,3}(?:,\d{3})*)/i);
    if (amountMatch) result.amountRequested = parseInt(amountMatch[1].replace(/,/g, ''));
    
    const vatMatch = message.match(/vat registered:\s*(yes|no)/i);
    if (vatMatch) result.vatRegistered = vatMatch[1].toLowerCase() === 'yes';
    
    const purposeMatch = message.match(/purpose of funding:\s*([^\n•]+)/i);
    if (purposeMatch) result.useOfFunds = purposeMatch[1].trim();
    
    const urgencyMatch = message.match(/urgency:\s*within\s*(\d+)\s*days?/i);
    if (urgencyMatch) result.urgencyDays = parseInt(urgencyMatch[1]);
    
    const provinceMatch = message.match(/province:\s*([^\n•,]+)/i);
    if (provinceMatch) result.province = provinceMatch[1].trim();
    
    console.log('Extracted from structured message:', result);
    return result;
  }
  
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
    
    // Handle contact information
    if (extracted.contact) {
      result.contact = {};
      if (extracted.contact.name) {
        result.contact.name = extracted.contact.name;
      }
      if (extracted.contact.email) {
        result.contact.email = extracted.contact.email;
      }
      if (extracted.contact.phone) {
        result.contact.phone = extracted.contact.phone;
      }
    }
  }
  
  // Then try to extract from the message if GPT didn't catch it
  if (!result.amountRequested || !result.monthlyTurnover) {
    // Look for multiple amounts in the message
    const amountMatches = Array.from(message.matchAll(/R\s*(\d{1,3}(?:,\d{3})*|\d+)k?/gi));
    
    for (const match of amountMatches) {
      const rawAmount = match[1].replace(/,/g, '');
      const amount = match[0].includes('k') ? parseInt(rawAmount) * 1000 : parseInt(rawAmount);
      
      if (amount > 1000 && amount < 100000000) {
        // Get context around the amount
        const index = match.index || 0;
        const contextBefore = message.slice(Math.max(0, index - 50), index).toLowerCase();
        const contextAfter = message.slice(index, Math.min(message.length, index + 50)).toLowerCase();
        const fullContext = contextBefore + contextAfter;
        
        // Determine what this amount represents
        if (!result.monthlyTurnover && (fullContext.includes('turnover') || fullContext.includes('revenue') || fullContext.includes('monthly'))) {
          result.monthlyTurnover = amount;
        } else if (!result.amountRequested && (fullContext.includes('need') || fullContext.includes('loan') || fullContext.includes('funding') || fullContext.includes('finance'))) {
          result.amountRequested = amount;
        }
      }
    }
  }

  // Extract industry from common patterns
  if (!result.industry) {
    const industryPatterns = [
      'robotics', 'retail', 'services', 'manufacturing', 'hospitality', 'logistics', 
      'construction', 'technology', 'tech', 'healthcare', 'education', 'consulting',
      'agriculture', 'automotive', 'finance', 'insurance', 'property', 'transport'
    ];
    
    const messageLower = message.toLowerCase();
    for (const pattern of industryPatterns) {
      if (messageLower.includes(pattern)) {
        // Capitalize first letter
        result.industry = pattern.charAt(0).toUpperCase() + pattern.slice(1);
        if (pattern === 'tech') result.industry = 'Technology';
        break;
      }
    }
  }

  if (!result.urgencyDays) {
    const daysMatch = message.match(/(\d+)\s*days?/i);
    if (daysMatch) {
      result.urgencyDays = parseInt(daysMatch[1]);
    }
  }

  // VAT detection with negative phrase handling
  if (result.vatRegistered === undefined) {
    const lower = message.toLowerCase();
    const negVat = /(not\s+(yet\s+)?vat[-\s]?registered|no\s+vat\b|not\s+registered\s+for\s+vat|without\s+vat|non-?vat)/i;
    const posVat = /(\bvat[-\s]?registered\b|registered\s+for\s+vat|vat\s+reg(istration)?\b|vat\s+number)/i;
    if (negVat.test(lower)) {
      result.vatRegistered = false;
    } else if (posVat.test(lower)) {
      result.vatRegistered = true;
    }
  }

  if (!result.yearsTrading) {
    const yearsMatch = message.match(/(\d+)\s*years?/i);
    if (yearsMatch) {
      result.yearsTrading = parseInt(yearsMatch[1]);
    }
  }

  // Extract contact information if not already captured
  if (!result.contact) {
    result.contact = {};
  }
  
  // Extract email addresses
  if (!result.contact.email) {
    const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      result.contact.email = emailMatch[1];
    }
  }
  
  // Extract phone numbers (SA format)
  if (!result.contact.phone) {
    const phoneMatches = [
      message.match(/(\+27\s*\d{2}\s*\d{3}\s*\d{4})/), // +27 11 123 4567
      message.match(/(0\d{2}\s*\d{3}\s*\d{4})/), // 011 123 4567
      message.match(/(\d{10})/), // 0111234567
      message.match(/(\+27\d{9})/), // +27111234567
    ];
    
    for (const match of phoneMatches) {
      if (match) {
        result.contact.phone = match[1].replace(/\s+/g, '');
        break;
      }
    }
  }
  
  // Extract business name (look for common patterns)
  if (!result.contact.name) {
    const businessPatterns = [
      /business name[:\s]+([^,\n.]+)/i,
      /company name[:\s]+([^,\n.]+)/i,
      /([A-Z][a-zA-Z\s&]+(?:Ltd|Pty|CC|Inc))/,
      /my business is called ([^,\n.]+)/i,
      /we are ([A-Z][a-zA-Z\s&]+)/i,
    ];
    
    for (const pattern of businessPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        result.contact.name = match[1].trim();
        break;
      }
    }
  }

  console.log('Final parsed extracted data:', result);
  return result;
}