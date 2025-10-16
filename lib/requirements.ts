export const REQUIREMENT_POLICY = {
  yearsTrading: "hard",
  monthlyTurnover: "hard", 
  amountRequested: "flex",
  urgencyDays: "flex",
  vatRegistered: "hard_or_none", // hard for lenders that require VAT; others ignore
  province: "hard",
  saRegistered: "hard",
  saDirector: "hard",
  bankStatements: "hard",
  collateralAcceptable: "refine" // affects which lenders rank higher
} as const;

export const OPENING_SMALL_GROUP = `
Tell me about your business:
• What industry are you in?
• How long have you been trading?
• What's your monthly turnover?
• How much funding do you need?
`;

export const NEXT_GROUP_1 = `Is your business registered in South Africa, and do you have at least one SA director?`;
export const NEXT_GROUP_2 = `Do you have 6+ months of bank statements?`;
export const NEXT_GROUP_3 = `Which province, and are you VAT registered?`;
export const NEXT_GROUP_4 = `Are you open to offering collateral?`;

export const DELTA_UP = ["Nice—more options just opened.", "Boom—unlocked a few more.", "Good—your shortlist grew."];
export const DELTA_DOWN = ["Two stepped out on criteria.", "Lost a couple there.", "A few bowed out."];
export const GUIDE = [
  "Best next move → compare top 3 by cost or speed.",
  "I recommend a side-by-side on the top 3.",
  "Strongest play: proceed with the cheapest fast option."
];

export const EDU = {
  "fixed-monthly": "Fixed monthly debit—predictable installments.",
  "percent-of-sales": "Pays as a % of sales—breathes with revenue.",
  "revolving": "Credit line—draw when needed, pay interest on usage."
};

export function formatRand(n: number): string {
  if (n >= 1_000_000) return `R${(n/1_000_000).toFixed(n%1_000_000===0?0:1)}M`;
  if (n >= 1_000) return `R${(n/1_000).toFixed(n%1_000===0?0:1)}k`;
  return `R${n.toLocaleString()}`;
}

export function announceDelta(prev:{q:number;n:number;u:number}|null, now:{q:number;n:number;u:number}) {
  if (!prev) return null;
  const dq = now.q - prev.q;
  if (dq > 0) return DELTA_UP[Math.floor(Math.random() * DELTA_UP.length)];
  if (dq < 0) return DELTA_DOWN[Math.floor(Math.random() * DELTA_DOWN.length)];
  return null;
}

// Simplified delta helper for UI integration
export function deltaLine(prev?: {q:number;n:number;u:number}, now?: {q:number;n:number;u:number}) {
  if (!prev || !now) return null;
  const dq = now.q - prev.q;
  if (dq > 0) return DELTA_UP[Math.floor(Math.random() * DELTA_UP.length)];
  if (dq < 0) return DELTA_DOWN[Math.floor(Math.random() * DELTA_DOWN.length)];
  return null;
}