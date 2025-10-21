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
  saRegistered?: boolean;  
  saDirector?: boolean;    
  bankStatements?: boolean; 
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
  
  if (p.productType === 'Term Loan' || p.productType === 'Working Capital') return 0;
  if (p.productType === 'Asset Finance') return 1;
  return 2; 
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

  const hasMinimumInfo = profile.yearsTrading !== undefined || 
                        profile.monthlyTurnover !== undefined || 
                        profile.amountRequested !== undefined;

  products.forEach((product) => {
    const reasons: string[] = [];
    const improvements: string[] = [];
    const missingRequirements: string[] = [];
    let closeMatchCount = 0;

    if (profile.saRegistered === false) {
      reasons.push('Must be registered SA business');
    }

    if (product.saDirectorRequired && profile.saDirector === false) {
      reasons.push('Must have at least one SA director');
    }

    if (profile.bankStatements === false) {
      reasons.push('6+ months bank statements required');
    }

    const hasBasics = profile.monthlyTurnover !== undefined && 
                     profile.yearsTrading !== undefined && 
                     profile.amountRequested !== undefined;
    
    if (!hasBasics) {
      
      missingRequirements.push('Need core business information first');
    } else {
      
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

    if (hasBasics && profile.yearsTrading !== undefined && profile.yearsTrading < product.minYears) {
      reasons.push(`Min ${product.minYears}y trading required, you have ${profile.yearsTrading}y`);
    }

    if (hasBasics && profile.monthlyTurnover !== undefined && profile.monthlyTurnover < product.minMonthlyTurnover) {
      
      reasons.push(`Min turnover R${formatAmount(product.minMonthlyTurnover)}/mo, you have R${formatAmount(profile.monthlyTurnover)}/mo`);
    }

    if (hasBasics && product.vatRequired && profile.vatRegistered === false) {
      improvements.push('Need VAT registration');
      closeMatchCount++;
    } else if (hasBasics && product.vatRequired && profile.vatRegistered === undefined) {
      missingRequirements.push('VAT registration status needed');
    }

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

    if (hasBasics && product.sectorExclusions && profile.industry && product.sectorExclusions.includes(profile.industry)) {
      reasons.push(`${profile.industry} sector excluded`);
    }

    if (hasBasics && product.provincesAllowed && profile.province && !product.provincesAllowed.includes(profile.province)) {
      reasons.push(`Not available in ${profile.province}`);
    }

    if (hasBasics && product.collateralRequired && profile.collateralAcceptable === false) {
      reasons.push('Collateral required, but you prefer no collateral');
    } else if (hasBasics && product.collateralRequired && profile.collateralAcceptable === undefined) {
      improvements.push('Collateral required - confirm if acceptable');
      closeMatchCount++;
    }

    if (missingRequirements.length > 0) {
      
      const allImprovements = [...missingRequirements, ...improvements];
      needMoreInfo.push({ 
        product, 
        reasons: reasons, 
        improvements: allImprovements 
      });
    } else if (reasons.length === 0 && improvements.length === 0) {
      
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
      
      needMoreInfo.push({ product, reasons: [], improvements });
    } else if (improvements.length > 0 && reasons.length <= 1) {
      
      needMoreInfo.push({ product, reasons, improvements });
    } else {
      
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