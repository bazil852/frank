import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { Profile, filterProducts } from './filters';
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

  private static systemPrompt = `You are Frank — I help South African businesses find funding they actually qualify for. No BS, no dead ends.

PERSONALITY & TONE:
- Be direct, conversational, and helpful
- Sound human, not robotic - avoid scripted phrases
- Focus on understanding their business first, then matching to funding
- Be encouraging and solution-focused

CONVERSATION FLOW:

1. FIRST INTERACTION - Understand their needs:
- Ask about their business: industry, revenue, years trading, funding amount needed
- Don't mention "match results" until you have basic business info
- Be curious and engaging: "Tell me about your business - what do you do and how much funding are you looking for?"

2. INFORMATION GATHERING:
- Capture multiple details at once from responses
- Ask specific follow-up questions naturally
- Example: "What industry are you in? How much monthly revenue? How long have you been trading?"

3. MATCHING & RESULTS (Only when you have enough info):
- Share results when they're meaningful: "Based on what you've told me, you qualify for 3 lenders..."
- Explain what's missing clearly: "To unlock 2 more options, I just need to know if you're VAT registered"
- Offer trade-offs when helpful: "At R2m, only 1 lender fits. Drop to R1.5m and 3 more open up"

4. NATURAL LANGUAGE RULES:
- Don't say "Right now you match with no lenders" for basic requests like "I need money"
- Don't mention match counts until you have business details to work with  
- Respond to their energy and context
- Keep responses conversational and helpful

EXAMPLES:

User: "hey i need money"
Good: "Hey there! I help businesses find funding they actually qualify for. Tell me about your business - what industry are you in and how much funding are you looking for?"
Bad: "Right now you match with no lenders, but 41 need more information..."

User: "I run a retail store, been trading 3 years, make R50k monthly, need R200k"
Good: "Great! Retail store, 3 years trading, R50k monthly - that opens up several options. Are you VAT registered? That would unlock even more lenders for you."
`;

  /**
   * Send a message to Frank and get a response
   */
  static async chat(
    message: string,
    chatHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [],
    profile: Partial<Profile> = {},
    availableProducts: Product[] = [],
    currentMatches?: {
      qualified: Product[];
      notQualified: Array<{ product: Product; reasons: string[] }>;
      needMoreInfo: Array<{ product: Product; reasons: string[]; improvements: string[] }>;
    }
  ): Promise<GPTResponse> {
    try {
      // Check if API key exists
      if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
        console.error('❌ NO OPENAI API KEY - Cannot extract data');
        throw new Error('OpenAI API key required for extraction');
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

      // Format current match results for GPT context with full details
      const matchContext = currentMatches ? {
        qualified: currentMatches.qualified.map(p => p.provider).join(', '),
        qualifiedCount: currentMatches.qualified.length,
        qualifiedDetails: currentMatches.qualified.map(p => `${p.provider}: R${(p.amountMin/1000)}k-R${(p.amountMax/1000)}k, ${p.speedDays[0]}-${p.speedDays[1]} days, ${p.interestRate ? `${p.interestRate[0]}%-${p.interestRate[1]}%` : 'rates vary'}`).join('\n'),
        notQualified: currentMatches.notQualified.map(item => `${item.product.provider} (${item.reasons.join('; ')})`).join(', '),
        notQualifiedCount: currentMatches.notQualified.length,
        needMoreInfo: currentMatches.needMoreInfo.map(item => `${item.product.provider} (needs: ${item.improvements.join('; ')})`).join(', '),
        needMoreInfoCount: currentMatches.needMoreInfo.length,
        needMoreInfoDetails: currentMatches.needMoreInfo.map(item => `${item.product.provider}: R${(item.product.amountMin/1000)}k-R${(item.product.amountMax/1000)}k, needs ${item.improvements.join(' & ')}`).join('\n')
      } : null;

      // Only provide match context if user has meaningful business info
      const hasBusinessInfo = Object.keys(profile).some(key => 
        ['industry', 'monthlyTurnover', 'yearsTrading', 'amountRequested'].includes(key)
      );

      const matchResultsText = matchContext && hasBusinessInfo ? `
CURRENT MATCH RESULTS (only mention if relevant to conversation):

QUALIFIED LENDERS (${matchContext.qualifiedCount}):
${matchContext.qualifiedDetails || 'NONE YET'}

NEED MORE INFO LENDERS (${matchContext.needMoreInfoCount}):
${matchContext.needMoreInfoDetails || 'NONE YET'}

NOT QUALIFIED (${matchContext.notQualifiedCount}): ${matchContext.notQualified || 'NONE YET'}

RESPONSE RULES:
- Only mention match results when they add value to the conversation
- If user just said "I need money" - focus on understanding their business first
- Use exact numbers: QUALIFIED = ${matchContext.qualifiedCount}, NEED MORE INFO = ${matchContext.needMoreInfoCount}, NOT QUALIFIED = ${matchContext.notQualifiedCount}
- You have full details about each qualified lender - use specific amounts, timeframes, and rates when helpful
- Don't mention match results until you have at least 2-3 pieces of business info
` : `
NO BUSINESS INFO YET - Focus on understanding their business first before mentioning any matches.

RESPONSE RULES:
- Don't mention "match results" or "lender counts" until you have business details
- Be conversational and focus on gathering: industry, revenue, years trading, funding amount
- Respond naturally to their request
`;

      // Format current profile for context
      const profileContext = Object.keys(profile).length > 0 ? `
CURRENT USER PROFILE:
${Object.entries(profile).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

NOTE: Do NOT ask for information that is already in the user's profile above.
` : 'No profile information collected yet.';

      const userPrompt = `User said: "${message}"

${profileContext}

CURRENT AVAILABLE LENDERS:
${productSummary}
${matchResultsText}
TASK: Respond as Frank naturally and extract any business information. Be conversational and human.

EXTRACTION FIELDS:
- industry, monthlyTurnover (number), amountRequested (number), yearsTrading (number)
- vatRegistered (boolean), useOfFunds, urgencyDays (number), province
- collateralAcceptable (boolean): true if user is okay with providing collateral, false if they prefer no collateral
- contact: {name, email, phone}

You must respond with valid JSON only:
{
  "summary": "your witty Frank response that mentions current matches",
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

      console.log('🤖 AI CONTEXT:', {
        userProfile: profile,
        currentMatches: matchContext ? {
          qualified: matchContext.qualifiedCount,
          needMoreInfo: matchContext.needMoreInfoCount,
          notQualified: matchContext.notQualifiedCount,
          qualifiedLenders: matchContext.qualified,
          needMoreInfoLenders: matchContext.needMoreInfo
        } : 'none'
      });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.1, // Lower temperature for more deterministic responses
        max_tokens: 300, // Shorter responses to reduce hallucination
        response_format: { type: "json_object" }
      });

      const response = completion.choices[0]?.message?.content || '{}';
      console.log('🤖 AI RAW RESPONSE:', response);

      try {
        const parsed = JSON.parse(response) as GPTResponse;
        
        return {
          summary: parsed.summary || "Let's get you matched with funding. Tell me about your business.",
          extracted: { ...parsed.extracted }
        };
      } catch (error) {
        console.error('❌ Failed to parse GPT response:', error);
        console.error('❌ RAW RESPONSE WAS:', response);
        throw new Error('Failed to parse GPT response: ' + error);
      }
    } catch (error) {
      console.error('❌ OpenAI API error (frontend):', error);
      throw error;
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

    // Extract amounts (improved to catch more patterns including "million")
    const amountMatches = Array.from(message.matchAll(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:million|mil|m|k)?/gi));
    
    for (const match of amountMatches) {
      const rawAmount = match[1].replace(/,/g, '');
      const matchText = match[0].toLowerCase();
      let amount = parseInt(rawAmount);
      
      // Apply multipliers
      if (matchText.includes('million') || matchText.includes('mil')) {
        amount = amount * 1000000;
      } else if (matchText.includes('k')) {
        amount = amount * 1000;
      }
      
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
    if (messageLower.includes('vat registered') || messageLower.includes('registered for vat') || messageLower.includes('vat yes')) {
      result.vatRegistered = true;
    } else if (messageLower.includes('not vat') || messageLower.includes('no vat') || messageLower.includes('vat no')) {
      result.vatRegistered = false;
    }

    // Extract collateral preferences
    if (messageLower.includes('collateral') && (messageLower.includes('ok') || messageLower.includes('okay') || messageLower.includes('yes') || messageLower.includes('fine') || messageLower.includes('acceptable'))) {
      result.collateralAcceptable = true;
    } else if (messageLower.includes('collateral') && (messageLower.includes('no') || messageLower.includes('not') || messageLower.includes('prefer not') || messageLower.includes('avoid'))) {
      result.collateralAcceptable = false;
    }

    // Extract industry (expanded list)
    const industries = ['retail', 'manufacturing', 'services', 'technology', 'construction', 'hospitality', 'logistics', 'robotics', 'healthcare', 'finance'];
    for (const industry of industries) {
      if (messageLower.includes(industry)) {
        result.industry = industry.charAt(0).toUpperCase() + industry.slice(1);
        break;
      }
    }

    // Extract provinces
    const provinces = ['gauteng', 'western cape', 'kzn', 'eastern cape', 'free state', 'north west', 'limpopo', 'mpumalanga', 'northern cape'];
    for (const province of provinces) {
      if (messageLower.includes(province)) {
        result.province = province === 'western cape' ? 'Western Cape' : 
                         province === 'kzn' ? 'KZN' : 
                         province.charAt(0).toUpperCase() + province.slice(1);
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