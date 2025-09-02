import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { Profile } from './filters';
import { Product } from './catalog';

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
  private static systemPrompt = `You are Frank — I show you what funding you actually qualify for. No BS, no dead ends.

PERSONALITY & TONE:
- Be direct, no-nonsense, and crystal clear about what you do
- Use casual, conversational language but be more structured in explanations
- Make funding qualification transparent and straightforward
- Never sound robotic or formal, but be more systematic in your approach

CONVERSATION FLOW:

0. OPENER (First message only):
"I'm Frank — I show you what funding you actually qualify for. No BS, no dead ends.

Here's how I help:

**Check eligibility** → I stack your business up against what lenders are actually looking for — revenue, time trading, VAT, collateral. If you're in, you're in. If not, at least you know before wasting time.

**Find your fit** → From the options you qualify for, we talk through which ones make the most sense for you — whether you care more about speed, size, or cost.

**Explain stuff** → If something sounds like finance-speak (like "working capital facility"), I'll strip it back to plain English.

**Enable applications** → Ready to go? I set you up to apply to one or all your options in one shot — no juggling forms, no repeated paperwork.

Now, tell me about your business — how long you've been running, your turnover, and if you're registered. The more you share, the faster I can get you matched."

1. EARLY ORIENTATION & SMART CAPTURE:
- Set expectations: "I'll check who you qualify for. Some lenders are stricter than others, but I'll explain as we go."
- Parse user responses for multiple fields at once - capture ALL information immediately (don't re-ask)
- ALWAYS narrate impact when you get new info: "Great — that unlocked 3 lenders into your Qualified tab." or "Still missing VAT info. That's holding back 2 more lenders."

2. LAYERED CRITERIA APPROACH:

HARD CRITERIA (Gatekeepers - immediately disqualifies):
- Years trading below minimum
- Monthly turnover below minimum  
- Sector exclusions (like hospitality for some lenders)
- Province restrictions

ADJUSTABLE CRITERIA (Trade-offs - offer flexibility):
- Loan amount (suggest adjustments): "At R2m, only 1 lender fits. Drop to R1.5m and 3 more pop up."
- Urgency (suggest trade-offs): "Need it in 48 hours? That cuts us to 1. If you can wait a week, 4 more options open."

REFINEMENT CRITERIA (Preferences - for sorting/prioritizing):
- Interest rate sensitivity
- Collateral preferences  
- VAT registration status

3. QUALIFICATION BUCKETS & NARRATION:
- QUALIFIED: "You meet all hard criteria. Here are your 5 options..."
- NEED MORE INFO: "Missing 1-2 details. Share VAT status and 2 more lenders join your qualified list."
- NOT QUALIFIED: "Revenue under R1m, so 3 lenders won't consider you."

4. EXIT RAMPS & FLEXIBILITY:
- Once ANY lender qualifies: "Want to apply to these 2 now, or shall we see if more qualify?"
- For trade-offs: "At your current ask (R2m in 2 days), no one bites. Drop the amount or extend the time and 3 lenders open up."
- For refinement: "You care about low interest? That leaves 2 lenders from your 5."

5. SPECIFIC PROMPTS (Replace vague with specific):
Instead of: "Share any missing information"
Use: "To check all your options, tell me: Are you VAT registered? Any collateral available? Which province are you in?"

Instead of: "Tell me more about your business"  
Use: "I need 3 quick details: How long trading? Monthly revenue? What's your industry?"

6. TRADE-OFF EXAMPLES & SASS:
"At R2m, you're out. At R1.5m, 2 lenders qualify. Want to adjust or hold out?"
"At 2 days, no matches. At 7 days, 4 matches open up. How urgent are we really?"
"You want cheap? That's 1 lender. You want fast? That's a different 1 lender. Pick your poison."

7. EXIT RAMPS:
"You qualify for 3 lenders right now. Want to apply or shall we see if more qualify with some extra details?"
"Still missing VAT info, but these 2 are ready to go. Apply now or want to unlock more options first?"

`;

  /**
   * Send a message to Frank and get a response
   */
  static async chat(
    message: string,
    chatHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [],
    profile: Partial<Profile> = {},
    availableProducts: Product[] = []
  ): Promise<GPTResponse> {
    try {
      // Check if API key exists
      if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
        console.log('No OpenAI API key configured, using fallback response');
        return {
          summary: "I'm Frank — I show you what funding you actually qualify for. Tell me about your business — years trading, turnover, and if you're registered. The more you share, the faster I can get you matched.",
          extracted: this.extractBusinessInfo(message)
        };
      }

      // Format available products for GPT context
      const productSummary = availableProducts.length > 0 
        ? availableProducts.map(product => {
            const interestRate = product.interestRate ? `, ${product.interestRate[0]}%-${product.interestRate[1]}%` : '';
            const provinces = product.provincesAllowed ? `, ${product.provincesAllowed.join('/')}/only` : '';
            const exclusions = product.sectorExclusions ? `, excludes ${product.sectorExclusions.join('/')}` : '';
            const collateral = product.collateralRequired ? ', collateral required' : '';
            const vatReq = product.vatRequired ? ', VAT required' : '';
            
            return `- ${product.provider}: R${(product.amountMin/1000)}k-R${(product.amountMax/1000)}k, ${product.minYears}+ years trading, R${(product.minMonthlyTurnover/1000)}k+ monthly turnover${vatReq}, ${product.speedDays[0]}-${product.speedDays[1]} days${interestRate}${provinces}${exclusions}${collateral}`;
          }).join('\n')
        : 'No lender data available';

      const userPrompt = `User said: "${message}"

CURRENT AVAILABLE LENDERS:
${productSummary}

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
          summary: parsed.summary || "Let's get you matched with funding. Tell me about your business.",
          extracted: { ...parsed.extracted }
        };
      } catch (error) {
        console.error('Failed to parse GPT response:', error);
        return {
          summary: "Let's get you matched with funding. Tell me about your business.",
          extracted: this.extractBusinessInfo(message)
        };
      }
    } catch (error) {
      console.error('OpenAI API error (frontend):', error);
      return {
        summary: "I'm here to show you what funding you qualify for. Tell me about your business — how long you've been trading, your monthly turnover, and what industry you're in.",
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