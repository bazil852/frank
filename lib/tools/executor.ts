import { handleBusinessProfileTool } from './business-profile';
import { handleLenderSearchTool } from './lender-search';
import { handleValidationTool } from './validation';
import { ToolNames } from './index';

export async function executeToolCall(
  toolName: string,
  args: any,
  userId: string,
  sessionId: string
): Promise<any> {
  console.log(`🔧 Executing tool: ${toolName}`, {
    args,
    userId,
    sessionId,
    timestamp: new Date().toISOString()
  });

  try {
    
    switch (toolName) {
      
      case ToolNames.GET_BUSINESS_PROFILE:
      case ToolNames.UPDATE_BUSINESS_PROFILE:
        return await handleBusinessProfileTool(toolName, args, userId);

      case ToolNames.SEARCH_LENDERS:
      case ToolNames.GET_LENDER_REQUIREMENTS:
      case ToolNames.CALCULATE_ELIGIBILITY:
        return await handleLenderSearchTool(toolName, args, userId);

      case ToolNames.VALIDATE_PROVINCE:
        return await handleValidationTool(toolName, args);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`❌ Tool execution error for ${toolName}:`, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      toolName,
      timestamp: new Date().toISOString()
    };
  }
}

export function validateToolArgs(toolName: string, args: any): boolean {
  
  return true;
}
