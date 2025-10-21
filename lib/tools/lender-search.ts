import { getLendersFromDB } from '@/lib/db-lenders';
import { filterProducts, type Profile } from '@/lib/filters';
import type { Product } from '@/lib/catalog';
import { ConversationTracker } from '@/lib/db-conversations';

export const lenderSearchTools = [
  {
    type: "function" as const,
    name: "search_lenders",
    description: "Searches for lenders matching the current business profile. Returns qualified lenders, near-misses (need more info), and rejected lenders with reasons. Use this after collecting enough profile data to show real-time matching results.",
    parameters: {
      type: "object",
      properties: {
        useCurrentProfile: {
          type: "boolean",
          description: "Whether to use the saved profile (true) or custom criteria (false). Usually true."
        },
        customCriteria: {
          type: "object",
          description: "Optional custom search criteria to override saved profile",
          properties: {
            minAmount: { type: "number" },
            maxAmount: { type: "number" },
            minYears: { type: "number" },
            province: { type: "string" },
            vatRegistered: { type: "boolean" }
          }
        }
      },
      required: ["useCurrentProfile"],
      additionalProperties: false,
    strict: false
    }
  },
  {
    type: "function" as const,
    name: "get_lender_requirements",
    description: "Gets detailed requirements for a specific lender including amount ranges, criteria, approval speed, fees, and product notes. Use when user asks about a specific lender.",
    parameters: {
      type: "object",
      properties: {
        lenderName: {
          type: "string",
          description: "Name of the lender (e.g., 'Lulalend', 'Bridgement', 'Merchant Capital')"
        }
      },
      required: ["lenderName"],
      additionalProperties: false,
    strict: false
    }
  },
  {
    type: "function" as const,
    name: "calculate_eligibility",
    description: "Calculates detailed eligibility for a specific lender based on current profile. Returns match percentage, specific requirements met/missed, and suggestions for improvement.",
    parameters: {
      type: "object",
      properties: {
        lenderId: {
          type: "string",
          description: "ID of the lender to check eligibility for"
        }
      },
      required: ["lenderId"],
      additionalProperties: false,
    strict: false
    }
  }
];

export async function handleLenderSearchTool(
  toolName: string,
  args: any,
  userId?: string
): Promise<any> {
  console.log(`🔍 Lender Search Tool: ${toolName}`, args);

  if (toolName === 'search_lenders') {
    try {
      
      const allLenders = await getLendersFromDB();
      console.log(`📊 Retrieved ${allLenders.length} lenders from database`);

      let profile: Partial<Profile>;
      if (args.useCurrentProfile) {
        profile = await ConversationTracker.getUserBusinessProfile(userId) || {};
      } else if (args.customCriteria) {
        profile = args.customCriteria;
      } else {
        profile = {};
      }

      console.log('👤 Using profile:', profile);

      const results = filterProducts(profile as Profile, allLenders);

      console.log('✅ Match results:', {
        qualified: results.qualified.length,
        needMoreInfo: results.needMoreInfo.length,
        notQualified: results.notQualified.length
      });

      return {
        success: true,
        qualified: results.qualified.map(lender => ({
          id: lender.id,
          provider: lender.provider,
          amountRange: `R${lender.amountMin.toLocaleString()} - R${lender.amountMax.toLocaleString()}`,
          speed: `${lender.speedDays[0]}-${lender.speedDays[1]} days`,
          minYears: lender.minYears,
          minTurnover: lender.minMonthlyTurnover,
          vatRequired: lender.vatRequired,
          collateralRequired: lender.collateralRequired
        })),
        needMoreInfo: results.needMoreInfo.map(item => ({
          id: item.product.id,
          provider: item.product.provider,
          reasons: item.reasons,
          improvements: item.improvements
        })),
        notQualified: results.notQualified.map(item => ({
          id: item.product.id,
          provider: item.product.provider,
          reasons: item.reasons
        })),
        summary: {
          qualifiedCount: results.qualified.length,
          needMoreInfoCount: results.needMoreInfo.length,
          notQualifiedCount: results.notQualified.length,
          profileCompleteness: Object.keys(profile).length
        }
      };
    } catch (error) {
      console.error('❌ Error searching lenders:', error);
      return {
        success: false,
        error: 'Failed to search lenders',
        qualified: [],
        needMoreInfo: [],
        notQualified: []
      };
    }
  }

  if (toolName === 'get_lender_requirements') {
    try {
      const allLenders = await getLendersFromDB();
      const lender = allLenders.find(
        l => l.provider.toLowerCase() === args.lenderName.toLowerCase()
      );

      if (!lender) {
        return {
          success: false,
          error: `Lender '${args.lenderName}' not found`,
          availableLenders: allLenders.map(l => l.provider)
        };
      }

      return {
        success: true,
        lender: {
          name: lender.provider,
          productType: lender.productType,
          amountRange: {
            min: lender.amountMin,
            max: lender.amountMax,
            formatted: `R${lender.amountMin.toLocaleString()} - R${lender.amountMax.toLocaleString()}`
          },
          requirements: {
            minYears: lender.minYears,
            minMonthlyTurnover: lender.minMonthlyTurnover,
            vatRequired: lender.vatRequired,
            collateralRequired: lender.collateralRequired,
            provincesAllowed: lender.provincesAllowed,
            sectorExclusions: lender.sectorExclusions
          },
          speed: {
            min: lender.speedDays[0],
            max: lender.speedDays[1],
            formatted: `${lender.speedDays[0]}-${lender.speedDays[1]} days`
          },
          notes: lender.notes
        }
      };
    } catch (error) {
      console.error('❌ Error getting lender requirements:', error);
      return {
        success: false,
        error: 'Failed to get lender requirements'
      };
    }
  }

  if (toolName === 'calculate_eligibility') {
    try {
      const allLenders = await getLendersFromDB();
      const lender = allLenders.find(l => l.id === args.lenderId);

      if (!lender) {
        return {
          success: false,
          error: `Lender with ID '${args.lenderId}' not found`
        };
      }

      const profile = await ConversationTracker.getUserBusinessProfile() || {};
      const results = filterProducts(profile as Profile, [lender]);

      let status: 'qualified' | 'needMoreInfo' | 'notQualified';
      let details: any;

      if (results.qualified.length > 0) {
        status = 'qualified';
        details = {
          message: 'Fully qualified for this lender',
          matchPercentage: 100
        };
      } else if (results.needMoreInfo.length > 0) {
        status = 'needMoreInfo';
        const match = results.needMoreInfo[0];
        details = {
          message: 'Close match - need more information',
          reasons: match.reasons,
          improvements: match.improvements,
          matchPercentage: 70
        };
      } else {
        status = 'notQualified';
        const match = results.notQualified[0];
        details = {
          message: 'Not qualified',
          reasons: match.reasons,
          matchPercentage: 30
        };
      }

      return {
        success: true,
        lenderName: lender.provider,
        status,
        ...details
      };
    } catch (error) {
      console.error('❌ Error calculating eligibility:', error);
      return {
        success: false,
        error: 'Failed to calculate eligibility'
      };
    }
  }

  throw new Error(`Unknown lender search tool: ${toolName}`);
}
