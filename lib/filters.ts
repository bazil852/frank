import { Product } from './catalog';
import { formatAmount } from './format-utils';
import { formatRand } from './requirements';

export type Profile = {
  industry?: string;
  yearsTrading?: number;
  monthlyTurnover?: number;
  vatRegistered?: boolean;
  amountRequested?: number;
  useOfFunds?: string;
  urgencyDays?: number;
  province?: string;
  collateralAcceptable?: boolean;
  saRegistered?: boolean;  // New: SA business registration
  saDirector?: boolean;    // New: SA director requirement
  bankStatements?: boolean; // New: 6+ months bank statements
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
};

type FilteredProduct = {
  product: Product;
  reasons: string[];
};

type NeedMoreInfoProduct = {
  product: Product;
  reasons: string[];
  improvements: string[];
};

type ScoredProduct = Product & { score: number };

export function pickSmallContext(matches: {
  qualified: Product[];
  notQualified: FilteredProduct[];
  needMoreInfo: NeedMoreInfoProduct[];
}) {
  return {
    qualified: matches.qualified.slice(0, 5),
    needMoreInfo: matches.needMoreInfo.slice(0, 3),
    notQualified: matches.notQualified.slice(0, 2)
  };
}

export function missingKeys(profile: Partial<Profile>): string[] {
  const required = ["monthlyTurnover", "yearsTrading", "amountRequested", "province", "vatRegistered"];
  return required.filter(k => profile[k as keyof Profile] === undefined);
}

export function sortByRefine(products: Product[], refine: "cost" | "speed" | "repayment" | "term" | "no-penalty") {
  switch (refine) {
    case "speed": 
      return [...products].sort((a,b) => a.speedDays[0] - b.speedDays[0]);
    case "cost": 
      return [...products].sort((a,b) => (a.interestRate?.[0] ?? 99) - (b.interestRate?.[0] ?? 99));
    case "repayment": 
      return [...products].sort((a,b) => rankRepay(a) - rankRepay(b));
    default: 
      return products;
  }
}

const rankRepay = (p: Product) => {
  // Fixed monthly first, then others
  if (p.productType === 'Term Loan' || p.productType === 'Working Capital') return 0;
  if (p.productType === 'Asset Finance') return 1;
  return 2; // MCA, Invoice, Revenue-based
};

export function computeLevers(profile: Partial<Profile>, matches: ReturnType<typeof filterProducts>) {
  const levers: string[] = [];
  
  if (profile.amountRequested && matches.qualified.length < 3) {
    const lower = Math.round(profile.amountRequested * 0.75);
    levers.push(`Drop to ${formatRand(lower)} → likely +matches`);
  }
  
  if (profile.urgencyDays && profile.urgencyDays <= 2) {
    levers.push(`If you can wait 3–5 days → more options`);
  }
  
  if (profile.collateralAcceptable === false) {
    levers.push(`If collateral becomes okay → more lenders`);
  }
  
  return levers;
}

export function filterProducts(
  profile: Profile,
  products: Product[]
): {
  qualified: Product[];
  notQualified: FilteredProduct[];
  needMoreInfo: NeedMoreInfoProduct[];
} {
  const qualified: ScoredProduct[] = [];
  const notQualified: FilteredProduct[] = [];
  const needMoreInfo: NeedMoreInfoProduct[] = [];

  // Check if we have minimum required information to make meaningful matches
  const hasMinimumInfo = profile.yearsTrading !== undefined || 
                        profile.monthlyTurnover !== undefined || 
                        profile.amountRequested !== undefined;

  products.forEach((product) => {
    const reasons: string[] = [];
    const improvements: string[] = [];
    const missingRequirements: string[] = [];
    let closeMatchCount = 0;

    // HARD REQUIREMENTS - Cannot be changed
    
    // SA Registration (hard requirement for all SA lenders)
    if (profile.saRegistered === false) {
      reasons.push('Must be registered SA business');
    }
    
    // SA Director (hard requirement only if lender requires it)
    if (product.saDirectorRequired && profile.saDirector === false) {
      reasons.push('Must have at least one SA director');
    }
    
    // Bank Statements (hard requirement for all)
    if (profile.bankStatements === false) {
      reasons.push('6+ months bank statements required');
    }
    
    // Only ask for missing hard requirements if we have the basics (turnover, years, amount)
    const hasBasics = profile.monthlyTurnover !== undefined && 
                     profile.yearsTrading !== undefined && 
                     profile.amountRequested !== undefined;
    
    if (!hasBasics) {
      // Missing core business info - can't evaluate any lender properly
      missingRequirements.push('Need core business information first');
    } else {
      // We have basics, now check specific missing fields for this lender
      if (profile.saRegistered === undefined) {
        missingRequirements.push('SA business registration status needed');
      }
      
      if (product.saDirectorRequired && profile.saDirector === undefined) {
        missingRequirements.push('SA director status needed');
      }
      
      if (profile.bankStatements === undefined) {
        missingRequirements.push('Bank statement availability needed');
      }
    }
    
    // Years Trading (hard requirement - cannot be changed)
    if (hasBasics && profile.yearsTrading !== undefined && profile.yearsTrading < product.minYears) {
      reasons.push(`Min ${product.minYears}y trading required, you have ${profile.yearsTrading}y`);
    }

    // Monthly Turnover (hard requirement - cannot be changed quickly)  
    if (hasBasics && profile.monthlyTurnover !== undefined && profile.monthlyTurnover < product.minMonthlyTurnover) {
      // Turnover is HARD - you can't just "increase" your turnover
      reasons.push(`Min turnover R${formatAmount(product.minMonthlyTurnover)}/mo, you have R${formatAmount(profile.monthlyTurnover)}/mo`);
    }

    // Check VAT registration (only if we have basics)
    if (hasBasics && product.vatRequired && profile.vatRegistered === false) {
      improvements.push('Need VAT registration');
      closeMatchCount++;
    } else if (hasBasics && product.vatRequired && profile.vatRegistered === undefined) {
      missingRequirements.push('VAT registration status needed');
    }

    // FLEX REQUIREMENTS - Can be adjusted (only if we have basics)
    
    // Amount Range (flex - user can adjust their request)
    if (hasBasics && profile.amountRequested !== undefined) {
      if (profile.amountRequested < product.amountMin) {
        const shortfall = product.amountMin - profile.amountRequested;
        const shortfallPercent = (shortfall / product.amountMin) * 100;
        
        if (shortfallPercent <= 20) {
          improvements.push(`Consider requesting at least R${formatAmount(product.amountMin)}`);
          closeMatchCount++;
        } else {
          reasons.push(`Min amount R${formatAmount(product.amountMin)}, you requested R${formatAmount(profile.amountRequested)}`);
        }
      } else if (profile.amountRequested > product.amountMax) {
        const excess = profile.amountRequested - product.amountMax;
        const excessPercent = (excess / product.amountMax) * 100;
        
        if (excessPercent <= 20) {
          improvements.push(`Consider reducing to max R${formatAmount(product.amountMax)}`);
          closeMatchCount++;
        } else {
          reasons.push(`Max amount R${formatAmount(product.amountMax)}, you requested R${formatAmount(profile.amountRequested)}`);
        }
      }
    }

    // Hard exclusions (only if we have basics and the relevant info)
    if (hasBasics && product.sectorExclusions && profile.industry && product.sectorExclusions.includes(profile.industry)) {
      reasons.push(`${profile.industry} sector excluded`);
    }

    if (hasBasics && product.provincesAllowed && profile.province && !product.provincesAllowed.includes(profile.province)) {
      reasons.push(`Not available in ${profile.province}`);
    }

    // Check collateral requirements (only if we have basics)
    if (hasBasics && product.collateralRequired && profile.collateralAcceptable === false) {
      reasons.push('Collateral required, but you prefer no collateral');
    } else if (hasBasics && product.collateralRequired && profile.collateralAcceptable === undefined) {
      improvements.push('Collateral required - confirm if acceptable');
      closeMatchCount++;
    }

    // Categorize the product
    // If we have missing requirements, put in needMoreInfo
    if (missingRequirements.length > 0) {
      // Combine missing requirements with any improvements
      const allImprovements = [...missingRequirements, ...improvements];
      needMoreInfo.push({ 
        product, 
        reasons: reasons, 
        improvements: allImprovements 
      });
    } else if (reasons.length === 0 && improvements.length === 0) {
      // Perfect match - only if we have enough info AND no issues
      let score = 1.0;

      if (profile.amountRequested !== undefined) {
        const range = product.amountMax - product.amountMin;
        const position = (profile.amountRequested - product.amountMin) / range;
        if (position < 0.1 || position > 0.9) {
          score -= 0.1;
        }
      }

      if (profile.urgencyDays !== undefined && profile.urgencyDays < product.speedDays[0]) {
        score -= 0.1;
      }

      if (profile.monthlyTurnover !== undefined) {
        const turnoverRatio = profile.monthlyTurnover / product.minMonthlyTurnover;
        if (turnoverRatio < 1.5) {
          score -= 0.05;
        }
      }

      qualified.push({ ...product, score });
    } else if (reasons.length === 0 && improvements.length > 0) {
      // Need more info - has potential improvements but no hard blockers
      needMoreInfo.push({ product, reasons: [], improvements });
    } else if (improvements.length > 0 && reasons.length <= 1) {
      // Need more info - mostly fixable issues with maybe one minor blocker
      needMoreInfo.push({ product, reasons, improvements });
    } else {
      // Not qualified - too many issues or hard blockers
      notQualified.push({ product, reasons });
    }
  });

  qualified.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 0.01) {
      return b.score - a.score;
    }
    return a.speedDays[0] - b.speedDays[0];
  });

  return {
    qualified: qualified.map(({ score, ...product }) => product),
    notQualified,
    needMoreInfo
  };
}