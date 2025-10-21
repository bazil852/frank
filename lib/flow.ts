import type { Profile } from './filters';

const have = (p: Partial<Profile>, k: keyof Profile) => p[k] !== undefined && p[k] !== null;

export function hasHardRequirements(p: Partial<Profile>) {
  return (
    
    have(p,'industry') &&
    have(p,'monthlyTurnover') &&
    have(p,'yearsTrading') &&
    have(p,'amountRequested') &&
    
    have(p,'saRegistered') &&
    have(p,'saDirector') &&
    have(p,'bankStatements') &&
    
    have(p,'province') &&
    have(p,'vatRegistered')
  );
}

export function nextQuestionGroup(p: Partial<Profile>): string | null {
  const miss = (k: keyof Profile) => p[k] === undefined;

  const group1Missing = [];
  if (miss('industry')) group1Missing.push('industry');
  if (miss('yearsTrading')) group1Missing.push('yearsTrading');
  if (miss('monthlyTurnover')) group1Missing.push('monthlyTurnover');
  if (miss('amountRequested')) group1Missing.push('amountRequested');

  if (group1Missing.length > 0) {
    
    const questions = [];
    if (group1Missing.includes('industry')) questions.push('• What industry are you in?');
    if (group1Missing.includes('yearsTrading')) questions.push('• How long have you been trading?');
    if (group1Missing.includes('monthlyTurnover')) questions.push('• What\'s your monthly turnover?');
    if (group1Missing.includes('amountRequested')) questions.push('• How much funding do you need?');

    if (group1Missing.length >= 3) {
      return `Tell me about your business:\n${questions.join('\n')}`;
    } else {
      return `Just need a bit more info:\n${questions.join('\n')}`;
    }
  }

  if (miss('saRegistered') || miss('saDirector')) return `Is your business registered in South Africa, and do you have at least one SA director?`;

  if (miss('bankStatements')) return `Do you have 6+ months of bank statements available?`;

  if (miss('province') || miss('vatRegistered')) return `Which province are you based in, and are you VAT registered?`;

  if (miss('collateralAcceptable')) return `Are you open to offering collateral if needed?`;

  return null;
}