export const ExtractSchema = {
  name: "FrankExtract",
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      extracted: {
        type: "object",
        properties: {
          industry: { type: "string" },
          monthlyTurnover: { type: "number" },
          amountRequested: { type: "number" },
          yearsTrading: { type: "number" },
          vatRegistered: { type: "boolean" },
          useOfFunds: { type: "string" },
          urgencyDays: { type: "number" },
          province: { type: "string" },
          collateralAcceptable: { type: "boolean" },
          saRegistered: { type: "boolean" },
          saDirector: { type: "boolean" },
          bankStatements: { type: "boolean" },
          contactName: { type: "string" },
          contactEmail: { type: "string" },
          contactPhone: { type: "string" }
        },
        additionalProperties: false
      }
    },
    required: ["extracted"],
    additionalProperties: false
  }
};

export const STYLE_BANK = [
  "Celebrate wins with fresh phrasing; avoid repeating yesterday's lines.",
  "Be punchy; one vivid line, then get back to progress.",
  "Swap bullets vs arrows; vary sentence length; no corporate clichés.",
  "Keep it human and specific; mention lenders by name when relevant.",
  "Use fresh metaphors; avoid 'unlock', 'journey', 'next steps' repetition."
];

export const CELEBRATE = [
  "Nice — unlocked more doors.",
  "Boom. New options just showed up.",
  "Love it. Your shortlist just grew.",
  "Perfect. That opens up fresh possibilities.",
  "Sweet — more lenders just joined the party."
];

export const DISQUALIFY = [
  "A couple stepped out on that requirement.",
  "Lost a few there — they want more history.",
  "Two bowed out; collateral was the snag.",
  "Some dropped off at that threshold.",
  "A few passed on those terms."
];

export const PROGRESS = [
  "Getting clearer picture now.",
  "Building your profile nicely.",
  "Good intel — helps narrow the field.",
  "Solid info — sharpens the focus.",
  "Helpful context — refining options."
];

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getStyleHint(): string {
  return pickRandom(STYLE_BANK);
}

// Keep last N phrases in memory to avoid repetition
const lastLines = new Set<string>();

export function dedupeLines(text: string): string {
  const lines = text.split('\n').map(l => l.trim());
  const fresh = lines.filter(l => l && !lastLines.has(l));
  fresh.forEach(l => lastLines.add(l));
  // cap memory
  if (lastLines.size > 200) lastLines.clear();

  // If everything was filtered out, return original text to avoid empty responses
  const result = fresh.join('\n');
  return result.trim() || text;
}

export function progressDelta(prev?: {q:number;n:number;d:number}, now?: {q:number;n:number;d:number}) {
  if (!prev || !now) return null;
  const dq = now.q - prev.q;
  if (dq > 0) return pickRandom(CELEBRATE);
  if (dq < 0) return pickRandom(DISQUALIFY);
  return pickRandom(PROGRESS);
}

export function amountLever(profile: Partial<any>, matches: any) {
  if (!profile.amountRequested) return "";
  if (matches.qualified.length >= 3) return "";
  const stepped = [0.75, 0.5].map((f: number) => Math.round((profile.amountRequested! * f)/1000)*1000);
  return `Levers: If we drop to R${stepped[0].toLocaleString()} or R${stepped[1].toLocaleString()}, more lenders may open up.`;
}