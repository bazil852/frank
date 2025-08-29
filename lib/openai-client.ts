import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { Profile } from './filters';

// Initialize OpenAI client for frontend use
// Note: In production, you should use a proxy/edge function to hide the API key
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true // Required for client-side usage
});

export interface GPTResponse {
  summary: string;
  extracted: Partial<Profile>;
}

export class FrankAI {
  private static systemPrompt = `You are Frank — the shortcut to funding that actually lands. No dead ends, no 30-page forms.

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
"Alright, based on your info, you've got matches. These lenders look good for you — and you can apply right now. No wasting time chasing dead ends."

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
- Finclusion: R100k-R750k, 2+ years trading, R250k+ monthly turnover, 5-7 days, excludes retail`;

  /**
   * Send a message to Frank and get a response
   */
  static async chat(
    message: string,
    chatHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [],
    profile: Partial<Profile> = {}
  ): Promise<GPTResponse> {
    try {
      // Check if API key exists
      if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
        console.log('No OpenAI API key configured, using fallback response');
        return {
          summary: "I'm Frank — the shortcut to funding that actually lands. Tell me about your business — years trading, turnover, and if you're registered. The more you share, the faster I can match you.",
          extracted: this.extractBusinessInfo(message)
        };
      }

      const userPrompt = `User said: "${message}"

TASK: Respond as Frank and extract any business information.

EXTRACTION FIELDS:
- industry, monthlyTurnover (number), amountRequested (number), yearsTrading (number)
- vatRegistered (boolean), useOfFunds, urgencyDays (number), province
- contact: {name, email, phone}

You must respond with valid JSON only:
{
  "summary": "your witty Frank response",
  "extracted": {field1: value1, ...}
}`;

      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: this.systemPrompt },
        ...chatHistory.slice(-10).map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        })),
        { role: 'user', content: userPrompt }
      ];

      console.log('Sending to OpenAI (frontend):', { message, profile });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.3,
        max_tokens: 400,
        response_format: { type: "json_object" }
      });

      const response = completion.choices[0]?.message?.content || '{}';
      console.log('OpenAI response (frontend):', response);

      try {
        const parsed = JSON.parse(response) as GPTResponse;
        return {
          summary: parsed.summary || "Let's get your funding sorted. Tell me about your business.",
          extracted: { ...parsed.extracted }
        };
      } catch (error) {
        console.error('Failed to parse GPT response:', error);
        return {
          summary: "Let's get your funding sorted. Tell me about your business.",
          extracted: this.extractBusinessInfo(message)
        };
      }
    } catch (error) {
      console.error('OpenAI API error (frontend):', error);
      return {
        summary: "I'm here to help you find funding. Tell me about your business — how long you've been trading, your monthly turnover, and what industry you're in.",
        extracted: this.extractBusinessInfo(message)
      };
    }
  }

  /**
   * Get match rationale for a specific product
   */
  static async getProductRationale(
    product: any,
    profile: Partial<Profile>
  ): Promise<string> {
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      return 'Well-suited for your business needs';
    }

    try {
      const prompt = `Given this business profile: ${JSON.stringify(profile)} 
and these product notes: "${product.notes}", 
provide a single bullet point rationale (max 18 words) for why this is a good match.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a funding advisor. Be concise and specific.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 50
      });

      return completion.choices[0]?.message?.content || 'Good fit for your business profile';
    } catch (error) {
      console.error('Error getting product rationale:', error);
      return 'Good fit for your business profile';
    }
  }

  /**
   * Extract business information from user message (fallback parser)
   */
  private static extractBusinessInfo(message: string): Partial<Profile> {
    const result: Partial<Profile> = {};
    const messageLower = message.toLowerCase();

    // Extract amounts
    const amountMatches = Array.from(message.matchAll(/R\s*(\d{1,3}(?:,\d{3})*|\d+)k?/gi));
    for (const match of amountMatches) {
      const rawAmount = match[1].replace(/,/g, '');
      const amount = match[0].includes('k') ? parseInt(rawAmount) * 1000 : parseInt(rawAmount);
      
      if (amount > 1000 && amount < 100000000) {
        const index = match.index || 0;
        const contextBefore = message.slice(Math.max(0, index - 50), index).toLowerCase();
        const contextAfter = message.slice(index, Math.min(message.length, index + 50)).toLowerCase();
        const fullContext = contextBefore + contextAfter;
        
        if (!result.monthlyTurnover && (fullContext.includes('turnover') || fullContext.includes('revenue') || fullContext.includes('monthly'))) {
          result.monthlyTurnover = amount;
        } else if (!result.amountRequested && (fullContext.includes('need') || fullContext.includes('loan') || fullContext.includes('funding'))) {
          result.amountRequested = amount;
        }
      }
    }

    // Extract years
    const yearsMatch = message.match(/(\d+)\s*years?/i);
    if (yearsMatch) {
      result.yearsTrading = parseInt(yearsMatch[1]);
    }

    // Extract VAT status
    if (messageLower.includes('vat registered') || messageLower.includes('registered for vat')) {
      result.vatRegistered = true;
    } else if (messageLower.includes('not vat') || messageLower.includes('no vat')) {
      result.vatRegistered = false;
    }

    // Extract industry
    const industries = ['retail', 'manufacturing', 'services', 'technology', 'construction', 'hospitality', 'logistics'];
    for (const industry of industries) {
      if (messageLower.includes(industry)) {
        result.industry = industry.charAt(0).toUpperCase() + industry.slice(1);
        break;
      }
    }

    // Extract contact info
    const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      result.contact = result.contact || {};
      result.contact.email = emailMatch[1];
    }

    const phoneMatch = message.match(/(\+27\s*\d{2}\s*\d{3}\s*\d{4}|0\d{2}\s*\d{3}\s*\d{4}|\d{10})/);
    if (phoneMatch) {
      result.contact = result.contact || {};
      result.contact.phone = phoneMatch[1].replace(/\s+/g, '');
    }

    return result;
  }
}