import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { Profile, filterProducts, pickSmallContext, computeLevers } from './filters';
import { Product } from './catalog';
import { ExtractSchema, getStyleHint, dedupeLines } from './ai-schemas';
import { EDU } from './requirements';
import { nextQuestionGroup, hasHardRequirements } from './flow';

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

  private static getSystemPrompt(): string {
    const styleHint = getStyleHint();
    return `You are Frank — SA funding matcher. Be sharp, human, concrete.
Use the 3-layer structure. Avoid repeated phrases. 120–180 words max.

Tone rules:
- Crisp, confident, playful—never cringe.
- Prefer specifics over hype.
- Ask for at most 2 missing facts at a time.

${styleHint}`;
  }

  /**
   * Extract business information using structured JSON schema
   */
  private static async extractBusinessInfo(message: string, currentProfile: Partial<Profile> = {}): Promise<Partial<Profile>> {
    try {
      // Build context about what we're still missing (ALL fields, not just Group 1)
      const missingFields = [];
      if (!currentProfile.industry) missingFields.push('industry');
      if (!currentProfile.yearsTrading) missingFields.push('years trading');
      if (!currentProfile.monthlyTurnover) missingFields.push('monthly turnover');
      if (!currentProfile.amountRequested) missingFields.push('funding amount');
      if (currentProfile.saRegistered === undefined) missingFields.push('SA business registration');
      if (currentProfile.saDirector === undefined) missingFields.push('SA director');
      if (currentProfile.bankStatements === undefined) missingFields.push('6+ months bank statements');
      if (!currentProfile.province) missingFields.push('province');
      if (currentProfile.vatRegistered === undefined) missingFields.push('VAT registration');

      const contextHint = missingFields.length > 0
        ? `Currently missing: ${missingFields.join(', ')}. If user provides "yes/no" or unlabeled values, infer based on what's missing.`
        : '';

      const extraction = await openai.responses.create({
        model: "gpt-5",
        instructions: `Extract business facts from the user message. Use context to infer unlabeled values.
CRITICAL: If a field is not mentioned or cannot be inferred, DO NOT include it in the output. Do not return empty strings, zeros, or false values unless explicitly stated.
South Africa context. ${contextHint}`,
        input: `Examples:
Input: 'I run a restaurant, been trading 2 years, make 300k a month, need 1.2m'
Output: {"extracted":{"industry":"Restaurant","yearsTrading":2,"monthlyTurnover":300000,"amountRequested":1200000}}

Input: 'hey' or 'hello' (greeting with no business info)
Output: {"extracted":{}}

Input: 'tell me more' (no new information)
Output: {"extracted":{}}

Input (when missing turnover and amount): '100k and 1 million'
Output: {"extracted":{"monthlyTurnover":100000,"amountRequested":1000000}}

Input (when missing amount): '500k'
Output: {"extracted":{"amountRequested":500000}}

Input: 'Yes, registered SA business with SA director, have 8 months bank statements'
Output: {"extracted":{"saRegistered":true,"saDirector":true,"bankStatements":true}}

Input (when missing ONLY bank statements): 'yes'
Output: {"extracted":{"bankStatements":true}}

Input (when missing ONLY VAT registration): 'no' or 'not registered'
Output: {"extracted":{"vatRegistered":false}}

Input (when missing SA registration and director): 'yes to both'
Output: {"extracted":{"saRegistered":true,"saDirector":true}}

Input: 'Not VAT registered yet, in Gauteng'
Output: {"extracted":{"vatRegistered":false,"province":"Gauteng"}}

Current profile: ${JSON.stringify(currentProfile)}

Now extract from:
${message}`,
        text: {
          format: {
            type: "json_schema",
            name: ExtractSchema.name,
            schema: ExtractSchema.schema,
            strict: false
          }
        }
      });

      const rawExtracted = JSON.parse(extraction.output_text).extracted as Partial<Profile>;

      // Clean up: remove empty strings, zeros, and false positives that should be undefined
      const extracted: Partial<Profile> = {};

      // Only include fields that have meaningful values
      if (rawExtracted.industry && rawExtracted.industry.trim() !== '') {
        extracted.industry = rawExtracted.industry;
      }
      if (rawExtracted.yearsTrading && rawExtracted.yearsTrading > 0) {
        extracted.yearsTrading = rawExtracted.yearsTrading;
      }
      if (rawExtracted.monthlyTurnover && rawExtracted.monthlyTurnover > 0) {
        extracted.monthlyTurnover = rawExtracted.monthlyTurnover;
      }
      if (rawExtracted.amountRequested && rawExtracted.amountRequested > 0) {
        extracted.amountRequested = rawExtracted.amountRequested;
      }
      if (rawExtracted.urgencyDays && rawExtracted.urgencyDays > 0) {
        extracted.urgencyDays = rawExtracted.urgencyDays;
      }
      if (rawExtracted.useOfFunds && rawExtracted.useOfFunds.trim() !== '') {
        extracted.useOfFunds = rawExtracted.useOfFunds;
      }
      if (rawExtracted.province && rawExtracted.province.trim() !== '') {
        extracted.province = rawExtracted.province;
      }

      // Boolean fields: only include if explicitly true or false (not undefined)
      if (rawExtracted.vatRegistered !== undefined && rawExtracted.vatRegistered !== null) {
        extracted.vatRegistered = rawExtracted.vatRegistered;
      }
      if (rawExtracted.collateralAcceptable !== undefined && rawExtracted.collateralAcceptable !== null) {
        extracted.collateralAcceptable = rawExtracted.collateralAcceptable;
      }
      if (rawExtracted.saRegistered !== undefined && rawExtracted.saRegistered !== null) {
        extracted.saRegistered = rawExtracted.saRegistered;
      }
      if (rawExtracted.saDirector !== undefined && rawExtracted.saDirector !== null) {
        extracted.saDirector = rawExtracted.saDirector;
      }
      if (rawExtracted.bankStatements !== undefined && rawExtracted.bankStatements !== null) {
        extracted.bankStatements = rawExtracted.bankStatements;
      }

      console.log('📊 Extracted data:', extracted);
      return extracted;
    } catch (error) {
      console.error('❌ Extraction error:', error);
      return {};
    }
  }

  /**
   * Generate response using small context and style variation
   */
  private static async generateResponse(
    message: string,
    profile: Partial<Profile>,
    matches: { qualified: Product[]; notQualified: any[]; needMoreInfo: any[] },
    chatHistory: ChatCompletionMessageParam[]
  ): Promise<string> {
    const small = pickSmallContext(matches);
    const nextGroup = nextQuestionGroup(profile);
    const basicsDone = hasHardRequirements(profile);
    const levers = basicsDone ? computeLevers(profile, matches) : [];

    // EARLY EXIT: if we still need required fields, ask for next group
    if (!basicsDone && nextGroup) {
      // Progressive disclosure: ask for the next set of missing fields
      const forced = [
        "Let's get you matched.",      // Layer 1
        "",
        nextGroup,                     // Layer 2 (ask for next missing group)
        "",
        "• Share those now\n• Ask what lenders usually look for" // Layer 3 CTAs (2 items)
      ].join("\n\n");

      // Don't dedupe the early question flow - these are structured questions that should always show
      return forced;
    }
    
    const profileText = Object.entries(profile)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n') || '- none';

    // Ground truth counts (use full lists, not trimmed small context)
    const counts = {
      qualified: matches.qualified.length,
      needMoreInfo: matches.needMoreInfo.length,
      notQualified: matches.notQualified.length
    };

    const genUser = `
USER:
"${message}"

KNOWN PROFILE (don't re-ask):
${profileText}

COUNTS (authoritative, do not invent):
qualified=${counts.qualified}, needMoreInfo=${counts.needMoreInfo}, notQualified=${counts.notQualified}

FLOW CONTROL:
BASICS_DONE=${basicsDone ? 'true' : 'false'}

LEVER HINTS:
${levers.join(' | ') || 'none'}

For education, use these one-liners when asked:
fixed-monthly → "${EDU['fixed-monthly']}"
percent-of-sales → "${EDU['percent-of-sales']}"
revolving → "${EDU['revolving']}"

RETURN JSON ONLY:
{
  "summary": "3-layer response (double line breaks between layers, max 180 words). Be a partner: suggest the best next move, but list 2 alternatives."
}

STRICT RULES:
- Never invent lender counts. Use COUNTS exactly as given.
- If qualified=0, say so and explain which facts are missing to unlock matches.
- Suggest practical levers (amount/urgency/collateral) when helpful.
- Turnover is HARD—do not suggest changing it.
- CTAs must be chosen from this list only (2–3 max): "Compare top 3 by cost", "See all qualified", "Apply to cheapest fast option", "Unlock maybes (2 quick questions)".
- Only show an emoji when qualified increased this turn.
- Never say "good fit for your business needs". Be crisp, confident, specific.
`;

    try {
      // For Responses API, we can pass a simple string or message array
      // If we have chat history, format it as a string context or use the simpler approach
      let inputContent = genUser;

      // Optionally prepend recent context if chat history exists
      if (chatHistory.length > 0) {
        const recentContext = chatHistory
          .filter(msg => msg.role !== 'system')
          .slice(-2) // Only last 2 exchanges
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n');
        inputContent = recentContext + '\n\nuser: ' + genUser;
      }

      const response = await openai.responses.create({
        model: "gpt-5",
        reasoning: { effort: "low" },
        instructions: this.getSystemPrompt(),
        input: inputContent,
        text: {
          format: {
            type: "json_object"
          }
        },
        max_output_tokens: 450,
        store: false
      });

      const parsed = JSON.parse(response.output_text);
      const rawSummary = parsed.summary || "Let's get you matched with funding. Tell me about your business.";

      return dedupeLines(rawSummary);
    } catch (error) {
      console.error('❌ Generation error:', error);
      return "I'm ready to help you find funding. What type of business do you run?";
    }
  }

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
      // Use existing chat streaming API route
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          chatHistory,
          profile,
          products: availableProducts,
          currentMatches
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
                const data = JSON.parse(line.slice(6)) as any;
                // Content chunk
                if (data && typeof data === 'object' && 'content' in data && data.content) {
                  fullResponse += data.content as string;
                  if (onUpdate) {
                    onUpdate({ type: 'content', content: data.content });
                  }
                }
                // Final chunk
                else if (data && data.done) {
                  extracted = data.extracted || {};
                  if (data.summary) {
                    fullResponse = data.summary;
                  }
                  if (onUpdate) {
                    onUpdate({ type: 'done', content: fullResponse, extracted, fullResponse });
                  }
                }
                // Error chunk
                else if (data && 'error' in data) {
                  throw new Error(data.error || 'Streaming error');
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
   * Send a message to Frank and get a response (with optional streaming and RAG)
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
    options: { stream?: boolean; skipRAG?: boolean } = {}
  ): Promise<GPTResponse | AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    try {
      // Get fresh lender data for filtering via API route (avoids HMR warnings)
      const res = await fetch('/api/lenders', { cache: 'no-store' });
      const allLenders = await res.json();
      console.log(`📊 Found ${allLenders.length} lenders from API`);

      const hasClientKey = !!process.env.NEXT_PUBLIC_OPENAI_API_KEY;

      // First, get structured extraction
      let newExtracted: Partial<Profile> = {};
      let updatedProfile: Partial<Profile> = { ...profile };
      let serverSummary: string | undefined;

      if (hasClientKey) {
        try {
          newExtracted = await this.extractBusinessInfo(message, updatedProfile);
        } catch (e) {
          console.warn('⚠️ Client-side extraction failed, falling back to server /api/gpt:', e);
          const serverResp = await this.serverStructured(message, updatedProfile, chatHistory);
          newExtracted = serverResp.extracted || {};
          serverSummary = serverResp.summary;
        }
      } else {
        const serverResp = await this.serverStructured(message, updatedProfile, chatHistory);
        newExtracted = serverResp.extracted || {};
        serverSummary = serverResp.summary;
      }

      updatedProfile = { ...updatedProfile, ...newExtracted };

      // Compute matches with whatever we have
      let matches = currentMatches;
      if (!matches && Object.keys(updatedProfile).length > 0) {
        matches = filterProducts(updatedProfile as Profile, allLenders);
      } else if (!matches) {
        matches = { qualified: [], notQualified: [], needMoreInfo: [] };
      }

      // Generate conversational summary
      let summary: string | undefined = serverSummary;
      if (hasClientKey) {
        try {
          const basicsDone = hasHardRequirements(updatedProfile);
          const historyForGen = basicsDone
            ? chatHistory.slice(-3).map(msg => ({
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content.length > 500 ? msg.content.slice(0, 500) : msg.content
              }))
            : [];
          summary = await this.generateResponse(message, updatedProfile, matches, historyForGen);
        } catch (e) {
          console.warn('⚠️ Client-side generation failed, using server or fallback summary:', e);
        }
      }

      if (!summary) {
        summary = "Let's get you matched with funding. Tell me about your business.";
      }

      console.log('🤖 FRANK RESPONSE:', {
        userProfile: updatedProfile,
        matchCounts: {
          qualified: matches.qualified.length,
          needMoreInfo: matches.needMoreInfo.length,
          notQualified: matches.notQualified.length
        },
        lendersInContext: allLenders?.length || 0
      });

      return {
        summary,
        extracted: newExtracted
      };
    } catch (error) {
      console.error('❌ OpenAI logic error (frontend):', error);
      // Final fallback
      return {
        summary: "I'm ready to help you find funding. What type of business do you run?",
        extracted: {}
      };
    }
  }

  /**
   * Server-side structured call using /api/gpt to avoid client-side key usage
   */
  private static async serverStructured(
    message: string,
    profile: Partial<Profile>,
    chatHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [],
  ): Promise<GPTResponse> {
    try {
      const resp = await fetch('/api/gpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, profile, chatHistory })
      });
      if (!resp.ok) throw new Error(`Server GPT failed: ${resp.status}`);
      const data = await resp.json();
      return {
        summary: data.summary || "Let's get you matched with funding. Tell me about your business.",
        extracted: data.extracted || {}
      };
    } catch (e) {
      console.error('❌ /api/gpt error:', e);
      return {
        summary: "Let's get you matched with funding. Tell me about your business.",
        extracted: {}
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
      return 'Fast approval with competitive terms';
    }

    try {
      const prompt = `Given this business profile: ${JSON.stringify(profile)} 
and these product notes: "${product.notes}", 
provide a single bullet point rationale (max 18 words) for why this matches their needs.`;

      const response = await openai.responses.create({
        model: 'gpt-5',
        reasoning: { effort: "low" },
        instructions: 'You are a funding advisor. Be concise and specific. Avoid "good fit" language.',
        input: prompt,
        max_output_tokens: 50,
        store: false
      });

      return response.output_text || 'Fast approval with competitive terms';
    } catch (error) {
      console.error('Error getting product rationale:', error);
      return 'Fast approval with competitive terms';
    }
  }

}