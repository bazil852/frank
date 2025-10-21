import { businessProfileTools } from './business-profile';
import { lenderSearchTools } from './lender-search';
import { validationTools } from './validation';

export const allTools = [
  ...businessProfileTools,
  ...lenderSearchTools,
  ...validationTools
];

export const ToolNames = {
  
  GET_BUSINESS_PROFILE: 'get_business_profile',
  UPDATE_BUSINESS_PROFILE: 'update_business_profile',

  SEARCH_LENDERS: 'search_lenders',
  GET_LENDER_REQUIREMENTS: 'get_lender_requirements',
  CALCULATE_ELIGIBILITY: 'calculate_eligibility',

  VALIDATE_PROVINCE: 'validate_province'
} as const;

export type ToolName = typeof ToolNames[keyof typeof ToolNames];
