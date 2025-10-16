import { supabase } from './supabase';
import type { Product } from './catalog';

export async function getLendersFromDB(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('lenders')
    .select('*')
    .order('provider', { ascending: true });

  if (error) {
    console.error('Error fetching lenders:', error);
    // Fall back to static data if database is not available
    const { PRODUCTS } = await import('./catalog');
    return PRODUCTS;
  }

  // Transform database format to application format
  return data.map((lender) => ({
    id: lender.id,
    provider: lender.provider,
    logo: lender.logo,
    productType: lender.product_type as Product['productType'],
    amountMin: lender.amount_min,
    amountMax: lender.amount_max,
    minYears: lender.min_years,
    minMonthlyTurnover: lender.min_monthly_turnover,
    vatRequired: lender.vat_required,
    provincesAllowed: lender.provinces_allowed || undefined,
    sectorExclusions: lender.sector_exclusions || undefined,
    speedDays: [lender.speed_days_min, lender.speed_days_max] as [number, number],
    collateralRequired: lender.collateral_required || undefined,
    notes: lender.notes || undefined,
  }));
}

export async function addLender(lender: Omit<Product, 'id'>): Promise<Product | null> {
  const { data, error } = await supabase
    .from('lenders')
    .insert({
      provider: lender.provider,
      logo: lender.logo,
      product_type: lender.productType,
      amount_min: lender.amountMin,
      amount_max: lender.amountMax,
      min_years: lender.minYears,
      min_monthly_turnover: lender.minMonthlyTurnover,
      vat_required: lender.vatRequired,
      provinces_allowed: lender.provincesAllowed || null,
      sector_exclusions: lender.sectorExclusions || null,
      speed_days_min: lender.speedDays[0],
      speed_days_max: lender.speedDays[1],
      collateral_required: lender.collateralRequired || null,
      notes: lender.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding lender:', error);
    return null;
  }

  return {
    id: data.id,
    provider: data.provider,
    logo: data.logo,
    productType: data.product_type as Product['productType'],
    amountMin: data.amount_min,
    amountMax: data.amount_max,
    minYears: data.min_years,
    minMonthlyTurnover: data.min_monthly_turnover,
    vatRequired: data.vat_required,
    provincesAllowed: data.provinces_allowed || undefined,
    sectorExclusions: data.sector_exclusions || undefined,
    speedDays: [data.speed_days_min, data.speed_days_max] as [number, number],
    collateralRequired: data.collateral_required || undefined,
    notes: data.notes || undefined,
    saDirectorRequired: data.sa_director_required || false,
    repaymentDescription: data.repayment_description || undefined,
  };
}

export async function updateLender(id: string, updates: Partial<Product>): Promise<Product | null> {
  const updateData: any = {};
  
  if (updates.provider !== undefined) updateData.provider = updates.provider;
  if (updates.logo !== undefined) updateData.logo = updates.logo;
  if (updates.productType !== undefined) updateData.product_type = updates.productType;
  if (updates.amountMin !== undefined) updateData.amount_min = updates.amountMin;
  if (updates.amountMax !== undefined) updateData.amount_max = updates.amountMax;
  if (updates.minYears !== undefined) updateData.min_years = updates.minYears;
  if (updates.minMonthlyTurnover !== undefined) updateData.min_monthly_turnover = updates.minMonthlyTurnover;
  if (updates.vatRequired !== undefined) updateData.vat_required = updates.vatRequired;
  if (updates.provincesAllowed !== undefined) updateData.provinces_allowed = updates.provincesAllowed || null;
  if (updates.sectorExclusions !== undefined) updateData.sector_exclusions = updates.sectorExclusions || null;
  if (updates.speedDays !== undefined) {
    updateData.speed_days_min = updates.speedDays[0];
    updateData.speed_days_max = updates.speedDays[1];
  }
  if (updates.collateralRequired !== undefined) updateData.collateral_required = updates.collateralRequired || null;
  if (updates.notes !== undefined) updateData.notes = updates.notes || null;
  if (updates.saDirectorRequired !== undefined) updateData.sa_director_required = updates.saDirectorRequired;
  if (updates.repaymentDescription !== undefined) updateData.repayment_description = updates.repaymentDescription || null;

  const { data, error } = await supabase
    .from('lenders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating lender:', error);
    return null;
  }

  return {
    id: data.id,
    provider: data.provider,
    logo: data.logo,
    productType: data.product_type as Product['productType'],
    amountMin: data.amount_min,
    amountMax: data.amount_max,
    minYears: data.min_years,
    minMonthlyTurnover: data.min_monthly_turnover,
    vatRequired: data.vat_required,
    provincesAllowed: data.provinces_allowed || undefined,
    sectorExclusions: data.sector_exclusions || undefined,
    speedDays: [data.speed_days_min, data.speed_days_max] as [number, number],
    collateralRequired: data.collateral_required || undefined,
    notes: data.notes || undefined,
    saDirectorRequired: data.sa_director_required || false,
    repaymentDescription: data.repayment_description || undefined,
  };
}

export async function deleteLender(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('lenders')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting lender:', error);
    return false;
  }

  return true;
}