import { Product } from './catalog';

export type Profile = {
  industry?: string;
  yearsTrading?: number;
  monthlyTurnover?: number;
  vatRegistered?: boolean;
  amountRequested?: number;
  useOfFunds?: string;
  urgencyDays?: number;
  province?: string;
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

  products.forEach((product) => {
    const reasons: string[] = [];
    const improvements: string[] = [];
    let closeMatchCount = 0;

    // Check years trading
    if (profile.yearsTrading !== undefined && profile.yearsTrading < product.minYears) {
      const yearsDiff = product.minYears - profile.yearsTrading;
      if (yearsDiff <= 1) {
        improvements.push(`Need ${yearsDiff} more year${yearsDiff === 1 ? '' : 's'} trading`);
        closeMatchCount++;
      } else {
        reasons.push(`Min ${product.minYears}y trading required, you have ${profile.yearsTrading}y`);
      }
    }

    // Check monthly turnover
    if (profile.monthlyTurnover !== undefined && profile.monthlyTurnover < product.minMonthlyTurnover) {
      const shortfall = product.minMonthlyTurnover - profile.monthlyTurnover;
      const shortfallPercent = (shortfall / product.minMonthlyTurnover) * 100;
      
      if (shortfallPercent <= 25) {
        improvements.push(`Need R${(shortfall / 1000).toFixed(0)}k more monthly turnover`);
        closeMatchCount++;
      } else {
        reasons.push(`Min turnover R${(product.minMonthlyTurnover / 1000).toFixed(0)}k/mo, you have R${(profile.monthlyTurnover / 1000).toFixed(0)}k/mo`);
      }
    }

    // Check VAT registration
    if (product.vatRequired && profile.vatRegistered === false) {
      improvements.push('Need VAT registration');
      closeMatchCount++;
    }

    // Check amount range
    if (profile.amountRequested !== undefined) {
      if (profile.amountRequested < product.amountMin) {
        const shortfall = product.amountMin - profile.amountRequested;
        const shortfallPercent = (shortfall / product.amountMin) * 100;
        
        if (shortfallPercent <= 20) {
          improvements.push(`Consider requesting at least R${(product.amountMin / 1000).toFixed(0)}k`);
          closeMatchCount++;
        } else {
          reasons.push(`Min amount R${(product.amountMin / 1000).toFixed(0)}k, you requested R${(profile.amountRequested / 1000).toFixed(0)}k`);
        }
      } else if (profile.amountRequested > product.amountMax) {
        const excess = profile.amountRequested - product.amountMax;
        const excessPercent = (excess / product.amountMax) * 100;
        
        if (excessPercent <= 20) {
          improvements.push(`Consider reducing to max R${(product.amountMax / 1000).toFixed(0)}k`);
          closeMatchCount++;
        } else {
          reasons.push(`Max amount R${(product.amountMax / 1000).toFixed(0)}k, you requested R${(profile.amountRequested / 1000).toFixed(0)}k`);
        }
      }
    }

    // Hard exclusions (never close matches)
    if (product.sectorExclusions && profile.industry && product.sectorExclusions.includes(profile.industry)) {
      reasons.push(`${profile.industry} sector excluded`);
    }

    if (product.provincesAllowed && profile.province && !product.provincesAllowed.includes(profile.province)) {
      reasons.push(`Not available in ${profile.province}`);
    }

    if (product.collateralRequired) {
      improvements.push('Collateral required');
      closeMatchCount++;
    }

    // Categorize the product
    if (reasons.length === 0 && improvements.length === 0) {
      // Perfect match
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