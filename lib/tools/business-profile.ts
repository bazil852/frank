import { ConversationTracker } from '@/lib/db-conversations';
import type { Profile } from '@/lib/filters';

/**
 * Tool definitions for business profile management
 */
export const businessProfileTools = [
  {
    type: "function" as const,
    name: "get_business_profile",
    description: "Retrieves the current business profile for this user session. Use this FIRST to check what information we already have before asking the user for anything.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    strict: false
    }
  },
  {
    type: "function" as const,
    name: "update_business_profile",
    description: "Updates the user's business profile with new information extracted from conversation. Can update multiple fields at once. Call this immediately after extracting any business information from the user.",
    parameters: {
      type: "object",
      properties: {
        industry: {
          type: "string",
          description: "Business industry (e.g., 'Retail', 'Services', 'Manufacturing', 'Hospitality')"
        },
        yearsTrading: {
          type: "number",
          description: "Number of years the business has been trading"
        },
        monthlyTurnover: {
          type: "number",
          description: "Monthly turnover/revenue in South African Rand (ZAR)"
        },
        amountRequested: {
          type: "number",
          description: "Amount of funding requested in South African Rand (ZAR)"
        },
        vatRegistered: {
          type: "boolean",
          description: "Whether the business is VAT registered"
        },
        province: {
          type: "string",
          description: "South African province (e.g., 'Gauteng', 'Western Cape', 'KZN')"
        },
        saRegistered: {
          type: "boolean",
          description: "Whether the business is registered in South Africa"
        },
        saDirector: {
          type: "boolean",
          description: "Whether the business has at least one South African director"
        },
        bankStatements: {
          type: "boolean",
          description: "Whether the business has 6+ months of bank statements available"
        },
        urgencyDays: {
          type: "number",
          description: "How soon the business needs funding (in days)"
        },
        collateralAcceptable: {
          type: "boolean",
          description: "Whether the business is willing to provide collateral"
        },
        useOfFunds: {
          type: "string",
          description: "What the funding will be used for (e.g., 'Working Capital', 'Inventory', 'Equipment')"
        }
      },
      additionalProperties: false,
    strict: false
    }
  }
];

/**
 * Execute business profile tool calls
 */
export async function handleBusinessProfileTool(
  toolName: string,
  args: any,
  userId: string
): Promise<any> {
  console.log(`📋 Business Profile Tool: ${toolName}`, { args, userId });

  if (toolName === 'get_business_profile') {
    try {
      const profile = await ConversationTracker.getUserBusinessProfile(userId);
      console.log('✅ Retrieved profile:', profile);

      return {
        success: true,
        profile: profile || {},
        message: profile && Object.keys(profile).length > 0
          ? `Found existing profile with ${Object.keys(profile).length} fields`
          : 'No existing profile found'
      };
    } catch (error) {
      console.error('❌ Error getting profile:', error);
      return {
        success: false,
        profile: {},
        error: 'Failed to retrieve profile'
      };
    }
  }

  if (toolName === 'update_business_profile') {
    try {
      // Validate and clean the data
      const cleanedData: Partial<Profile> = {};

      if (args.industry) cleanedData.industry = String(args.industry);
      if (args.yearsTrading !== undefined) cleanedData.yearsTrading = Number(args.yearsTrading);
      if (args.monthlyTurnover !== undefined) cleanedData.monthlyTurnover = Number(args.monthlyTurnover);
      if (args.amountRequested !== undefined) cleanedData.amountRequested = Number(args.amountRequested);
      if (args.vatRegistered !== undefined) cleanedData.vatRegistered = Boolean(args.vatRegistered);
      if (args.province) cleanedData.province = String(args.province);
      if (args.saRegistered !== undefined) cleanedData.saRegistered = Boolean(args.saRegistered);
      if (args.saDirector !== undefined) cleanedData.saDirector = Boolean(args.saDirector);
      if (args.bankStatements !== undefined) cleanedData.bankStatements = Boolean(args.bankStatements);
      if (args.urgencyDays !== undefined) cleanedData.urgencyDays = Number(args.urgencyDays);
      if (args.collateralAcceptable !== undefined) cleanedData.collateralAcceptable = Boolean(args.collateralAcceptable);
      if (args.useOfFunds) cleanedData.useOfFunds = String(args.useOfFunds);

      await ConversationTracker.updateUserBusinessProfile(cleanedData, userId);
      console.log('✅ Updated profile with:', cleanedData);

      return {
        success: true,
        updated: cleanedData,
        message: `Successfully updated ${Object.keys(cleanedData).length} field(s)`
      };
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      return {
        success: false,
        error: 'Failed to update profile'
      };
    }
  }

  throw new Error(`Unknown business profile tool: ${toolName}`);
}
