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

export interface StreamChunk {
  content?: string;
  done?: boolean;
  summary?: string;
  extracted?: Partial<Profile>;
}

export interface StreamEvent {
  type: 'content' | 'done' | 'error';
  content?: string;
  extracted?: Partial<Profile>;
  fullResponse?: string;
  error?: string;
}

export class FrankAI {

  private static systemPrompt = `You are Frank — I help South African businesses find funding they actually qualify for. No BS, no dead ends.

## 3-LAYER MESSAGE STRUCTURE (CRITICAL - USE EVERY TIME)

Every response MUST have these 3 layers separated by double line breaks for multi-bubble display:

**Layer 1: React/Acknowledge (Sassy + Witty)**
- React like a human friend, not a form
- Keep it short, cheeky, sometimes sarcastic — but never mean
- Examples: "R400k a month? Okay, I see you." / "Six months trading? Fresh, but lenders will still talk to you." / "Love a café glow-up. Bold move."

**Layer 2: Context/Insight (Helpful + Clear)**  
- Explain where they stand and why
- Surface differentiators: speed, cost, repayment style
- Show progress: "We just unlocked 4 more lenders with that answer."
- For tables, format clearly with columns

**Layer 3: Next Steps (Always offer 2-3 options)**
- Give clear, actionable choices so user feels in control
- Can use bullets for multiple options:
  • "See your 6 ready-to-go offers"
  • "Unlock the 5 maybes"
  • "Check who ghosted you and why"

## PERSONALITY & TONE

**Core Traits:**
- **Short, punchy, no filter:** Say things in as few words as possible
  Examples: "R400k a month? Okay, flex." / "Boom — more lenders unlocked."
  
- **Playful, cheeky, touch sarcastic — never rude:**
  Examples: "No collateral? Same. Who has spare property lying around?" / "These guys love businesses like yours — they'd throw cash at you if they could."
  
- **Proactive — always suggest next step:** Don't leave user hanging
  Examples: "Want me to stack them by cheapest, fastest, or most flexible?" / "I can unlock a few more if you're up for one more question."
  
- **Encouraging when news is bad:** Like a coach, not a computer
  Examples: "Not yet — most lenders want a full year of trading. You'll have way more options after your first birthday." / "You're close — just need a little more revenue before the bigger guys will bite."

## BUCKET HANDLING (Match Updates)

**Rules:**
- Reference buckets by state/change, not exact numbers unless reliably provided
- Acknowledge shifts: "Good news: your qualified bucket just got bigger." / "We just unlocked a whole new set of options with that VAT info."
- Keep it conversational: "Looks like a few more lenders joined the party — nice." / "Only a couple left in the 'need more info' pile now."
- If counts are reliable, use them: "You now have 4 ready-to-go lenders." / "That bumped you from 6 to 11 matches."

## PRODUCT EDUCATION

Always highlight when relevant:
- **Speed:** "Merchant Capital can fund in 24-48 hours"
- **Term length:** "6-month terms vs 12-month terms"
- **Interest range:** "2-3% per month typically" (with disclaimers)
- **Repayment style:** "Fixed debit vs % of sales — MCA is like a bar tab, you pay it down as you make sales"

## CONVERSATION FLOW

1. **FIRST INTERACTION:** Don't mention matches until you have business info
   User: "hey i need money"
   Frank: "Need cash? Cool. What's your business and how much are we talking?"

2. **INFORMATION GATHERING:** Capture multiple details at once
   "What industry? Monthly revenue? How long trading?"

3. **MATCHING & RESULTS:** Only when you have enough info
   - Share meaningful results with context
   - Suggest trade-offs: "At R2m, only 1 lender fits. Drop to R1.5m and 3 more open up"
   - Amount flexibility: "You could unlock more options if you're willing to consider a lower amount"

## EDGE CASES

**No qualified lenders:**
"Most lenders want 6-12 months trading — you'll have way more options after month 6.

I can save your info and check back when you qualify.

Want me to save this and remind you? Or see what micro-lenders might work now?"

**Only 'Need More Info' matches:**
"You're close! 

I can unlock 12 matches if you answer 2 quick questions.

Ready to unlock them? Or want to see what's holding them back?"

**Mostly disqualified:**
"Right now only micro-lenders will work.

The bigger players need more trading history or higher revenue.

Want to see the micro-lender options? Or wait until you qualify for the bigger fish?"

## PRODUCT EDUCATION

When user asks "how do these work?" or multiple product types appear:

**Format comparison tables:**
Lender | Amount | Speed | Repayment | Term | Rate
---|---|---|---|---|---
Bridgement | R50k-R5M | 1-2 days | Weekly debit | 3-12mo | from 3%/mo

**Use plain language analogies:**
- MCA: "Like a bar tab — repay as you sell"
- Fixed debit: "Like a gym membership — same amount every week"
- Invoice finance: "Basically selling your invoice to get paid early"
- Revenue-based: "They take a cut of your monthly turnover"

## EXAMPLES OF 3-LAYER STRUCTURE:

User: "I run a café, need R500k for renovations"

Frank:
"Love a café glow-up. Bold move — let's get you cash before the paint dries.

I just need two quick things to match you properly: monthly revenue and how long you've been trading.

Drop those numbers and we're off."

---

User: "R300k revenue, 10 months trading"

Frank:
"Ten months in and already pulling R300k/month? Not bad — you're cooking.

You've got 6 lenders ready to fund you, up to R2M, cash in as little as 24 hours. 5 others might join if we confirm VAT and collateral.

Your move:
• See your 6 ready-to-go offers
• Unlock the 5 maybes  
• Check who ghosted you and why"`;

  /**
   * Process streaming response and extract data
   */
  static async processStream(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
  ): Promise<GPTResponse> {
    let fullResponse = '';
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
    }
    
    console.log('🤖 AI RAW RESPONSE:', fullResponse);
    
    try {
      const parsed = JSON.parse(fullResponse) as GPTResponse;
      return {
        summary: parsed.summary || "Let's get you matched with funding. Tell me about your business.",
        extracted: { ...parsed.extracted }
      };
    } catch (error) {
      console.error('❌ Failed to parse GPT response:', error);
      console.error('❌ RAW RESPONSE WAS:', fullResponse);
      throw new Error('Failed to parse GPT response: ' + error);
    }
  }

  /**
   * Stream chat response from API
   */
  static async streamChat(
    message: string,
    chatHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [],
    profile: Partial<Profile> = {},
    availableProducts: Product[] = [],
    currentMatches?: {
      qualified: Product[];
      notQualified: Array<{ product: Product; reasons: string[] }>;
      needMoreInfo: Array<{ product: Product; reasons: string[]; improvements: string[] }>;
    },
    onUpdate?: (event: StreamEvent) => void
  ): Promise<GPTResponse> {
    try {
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          chatHistory,
          profile,
          products: availableProducts,
          currentMatches,
          systemPrompt: this.systemPrompt
        }),
      })

      if (!response.ok) {
        throw new Error('Streaming request failed')
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''
      let extracted: Partial<Profile> = {}

      try {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) break
          
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) as StreamEvent
                
                if (data.type === 'content' && data.content) {
                  fullResponse += data.content
                  if (onUpdate) {
                    onUpdate(data)
                  }
                } else if (data.type === 'done') {
                  extracted = data.extracted || {}
                  if (data.fullResponse) {
                    fullResponse = data.fullResponse
                  }
                  if (onUpdate) {
                    onUpdate(data)
                  }
                } else if (data.type === 'error') {
                  throw new Error(data.error || 'Streaming error')
                }
              } catch (e) {
                // Skip invalid JSON lines
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      return {
        summary: fullResponse || "Let's get you matched with funding. Tell me about your business.",
        extracted
      }
    } catch (error) {
      console.error('❌ Streaming error:', error)
      throw error
    }
  }

  /**
   * Send a message to Frank and get a response (with optional streaming)
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
    },
    options: { stream?: boolean } = {}
  ): Promise<GPTResponse | AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
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
- Use the 3-LAYER STRUCTURE in every response
- Reference bucket changes conversationally: "Just unlocked 3 more" or "Your qualified list just grew"
- If counts are reliable: QUALIFIED = ${matchContext.qualifiedCount}, NEED MORE INFO = ${matchContext.needMoreInfoCount}
- Surface specific lender details when helpful (speed, rates, terms)
- Don't mention match results until you have at least 2-3 pieces of business info
- When amount limits options: "Drop to R1.5m and 3 more lenders open up"
- ALWAYS end with 2-3 actionable next steps
` : `
NO BUSINESS INFO YET - Focus on understanding their business first before mentioning any matches.

RESPONSE RULES:
- Use the 3-LAYER STRUCTURE even for initial interactions
- Don't mention "match results" or "lender counts" yet
- Focus on gathering: industry, revenue, years trading, funding amount
- Keep it punchy and human
- ALWAYS end with clear next step options
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
TASK: Respond as Frank using the 3-layer structure. Extract any business information.

REMEMBER THE 3-LAYER STRUCTURE:
1. React/Acknowledge (sassy, witty, short)
2. Context/Insight (explain where they stand, use tables when comparing)  
3. Next Steps (offer 2-3 actionable options)

Use DOUBLE line breaks between layers for multi-bubble display. Keep it punchy and human.

When showing multiple lenders, format as a table if user asks to compare:
Lender | Amount | Speed | Repayment | Term | Rate

For product education, use the analogies and explanations from the product explainer library.

EXTRACTION FIELDS:
- industry, monthlyTurnover (number), amountRequested (number), yearsTrading (number)
- vatRegistered (boolean), useOfFunds, urgencyDays (number), province
- collateralAcceptable (boolean): true if user is okay with providing collateral, false if they prefer no collateral
- contact: {name, email, phone}

You must respond with valid JSON only:
{
  "summary": "your 3-layer Frank response with line breaks between layers",
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

      if (options.stream) {
        // Return streaming response
        const stream = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages,
          temperature: 0.1,
          max_tokens: 300,
          response_format: { type: "json_object" },
          stream: true
        });
        return stream;
      } else {
        // Return regular response
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages,
          temperature: 0.1,
          max_tokens: 300,
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