import { businessProfileTools } from './business-profile';
import { lenderSearchTools } from './lender-search';
import { validationTools } from './validation';

/**
 * All available tools for GPT-5 function calling
 */
export const allTools = [
  ...businessProfileTools,
  ...lenderSearchTools,
  ...validationTools
];

/**
 * Tool names for easy reference
 */
export const ToolNames = {
  // Business Profile
  GET_BUSINESS_PROFILE: 'get_business_profile',
  UPDATE_BUSINESS_PROFILE: 'update_business_profile',

  // Lender Search
  SEARCH_LENDERS: 'search_lenders',
  GET_LENDER_REQUIREMENTS: 'get_lender_requirements',
  CALCULATE_ELIGIBILITY: 'calculate_eligibility',

  // Validation
  VALIDATE_PROVINCE: 'validate_province'
} as const;

export type ToolName = typeof ToolNames[keyof typeof ToolNames];
