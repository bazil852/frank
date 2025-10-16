/**
 * Format amounts properly - no more 2000k bullshit
 */
export function formatAmount(amount: number | null | undefined): string {
  if (amount == null) return 'N/A';
  
  if (amount >= 1000000) {
    const millions = amount / 1000000;
    return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(1)}M`;
  } else if (amount >= 1000) {
    const thousands = amount / 1000;
    return thousands % 1 === 0 ? `${thousands}k` : `${thousands.toFixed(0)}k`;
  } else {
    return amount.toString();
  }
}

/**
 * Format speed ranges
 */
export function formatSpeed(speedDays: [number, number]): string {
  if (speedDays[0] === speedDays[1]) {
    return `${speedDays[0]} day${speedDays[0] > 1 ? 's' : ''}`;
  }
  return `${speedDays[0]}-${speedDays[1]} days`;
}

/**
 * Format interest rates
 */
export function formatRate(interestRate?: [number, number]): string {
  if (!interestRate) return '';
  if (interestRate[0] === interestRate[1]) {
    return `${interestRate[0]}%`;
  }
  return `${interestRate[0]}-${interestRate[1]}%`;
}