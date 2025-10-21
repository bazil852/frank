
export const validationTools = [
  {
    type: "function" as const,
    name: "validate_province",
    description: "Validates if a province name is a valid South African province. Returns the standardized name if valid, or suggests corrections if invalid.",
    parameters: {
      type: "object",
      properties: {
        province: {
          type: "string",
          description: "Province name to validate (e.g., 'Gauteng', 'Western Cape', 'KZN')"
        }
      },
      required: ["province"],
      additionalProperties: false,
    strict: false
    }
  }
];

const PROVINCES: Record<string, string[]> = {
  'Gauteng': ['gauteng', 'gautang', 'gt', 'jhb', 'johannesburg', 'pretoria'],
  'Western Cape': ['western cape', 'wc', 'cape town', 'ct', 'w cape', 'western-cape'],
  'KwaZulu-Natal': ['kwazulu-natal', 'kzn', 'natal', 'durban', 'kwazulu natal'],
  'Eastern Cape': ['eastern cape', 'ec', 'e cape', 'eastern-cape', 'port elizabeth'],
  'Free State': ['free state', 'fs', 'freestate', 'bloemfontein'],
  'Limpopo': ['limpopo', 'lp', 'polokwane'],
  'Mpumalanga': ['mpumalanga', 'mp', 'nelspruit'],
  'North West': ['north west', 'nw', 'northwest', 'north-west'],
  'Northern Cape': ['northern cape', 'nc', 'n cape', 'northern-cape', 'kimberley']
};

export async function handleValidationTool(
  toolName: string,
  args: any
): Promise<any> {
  console.log(`✅ Validation Tool: ${toolName}`, args);

  if (toolName === 'validate_province') {
    const input = args.province?.toLowerCase().trim();

    if (!input) {
      return {
        valid: false,
        error: 'Province name is required'
      };
    }

    for (const [standardName, variations] of Object.entries(PROVINCES)) {
      if (variations.includes(input) || standardName.toLowerCase() === input) {
        return {
          valid: true,
          standardName,
          originalInput: args.province,
          message: `Valid province: ${standardName}`
        };
      }
    }

    const allProvinces = Object.keys(PROVINCES);
    return {
      valid: false,
      originalInput: args.province,
      message: `'${args.province}' is not a valid SA province`,
      suggestions: allProvinces,
      hint: 'Valid provinces: ' + allProvinces.join(', ')
    };
  }

  throw new Error(`Unknown validation tool: ${toolName}`);
}
