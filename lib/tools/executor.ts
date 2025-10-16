import { handleBusinessProfileTool } from './business-profile';
import { handleLenderSearchTool } from './lender-search';
import { handleValidationTool } from './validation';
import { ToolNames } from './index';

/**
 * Execute a tool call from GPT-5
 * @param toolName Name of the tool to execute
 * @param args Arguments for the tool
 * @param userId User ID for context
 * @param sessionId Session ID for context
 * @returns Tool execution result
 */
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
    // Route to appropriate handler based on tool name
    switch (toolName) {
      // Business Profile Tools
      case ToolNames.GET_BUSINESS_PROFILE:
      case ToolNames.UPDATE_BUSINESS_PROFILE:
        return await handleBusinessProfileTool(toolName, args, userId);

      // Lender Search Tools
      case ToolNames.SEARCH_LENDERS:
      case ToolNames.GET_LENDER_REQUIREMENTS:
      case ToolNames.CALCULATE_ELIGIBILITY:
        return await handleLenderSearchTool(toolName, args, userId);

      // Validation Tools
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

/**
 * Validate tool arguments before execution
 */
export function validateToolArgs(toolName: string, args: any): boolean {
  // Add validation logic here if needed
  return true;
}
