export type Product = {
  id: string;
  provider: string;
  logo: string;
  productType: 'Working Capital' | 'Invoice Discounting' | 'Merchant Cash Advance' | 'Asset Finance' | 'Term Loan';
  amountMin: number;
  amountMax: number;
  minYears: number;
  minMonthlyTurnover: number;
  vatRequired: boolean;
  provincesAllowed?: string[];
  sectorExclusions?: string[];
  speedDays: [number, number];
  collateralRequired?: boolean;
  notes?: string;
};

export const PRODUCTS: Product[] = [
  {
    id: 'bridgement-wc',
    provider: 'Bridgement',
    logo: '/logos/bridgement.svg',
    productType: 'Working Capital',
    amountMin: 250000,
    amountMax: 1000000,
    minYears: 2,
    minMonthlyTurnover: 200000,
    vatRequired: true,
    speedDays: [3, 5],
    notes: 'Fast approval for VAT-registered businesses with consistent cashflow'
  },
  {
    id: 'merchant-capital-mca',
    provider: 'Merchant Capital',
    logo: '/logos/merchant-capital.svg',
    productType: 'Merchant Cash Advance',
    amountMin: 50000,
    amountMax: 5000000,
    minYears: 1,
    minMonthlyTurnover: 100000,
    vatRequired: false,
    speedDays: [1, 2],
    notes: 'Quick funding against future card sales, perfect for retail and hospitality'
  },
  {
    id: 'lulalend-term',
    provider: 'Lulalend',
    logo: '/logos/lulalend.svg',
    productType: 'Term Loan',
    amountMin: 20000,
    amountMax: 2000000,
    minYears: 1,
    minMonthlyTurnover: 50000,
    vatRequired: false,
    speedDays: [2, 3],
    provincesAllowed: ['Gauteng', 'Western Cape', 'KZN'],
    notes: 'Flexible terms for growing SMEs in major metros'
  },
  {
    id: 'retail-capital-invoice',
    provider: 'Retail Capital',
    logo: '/logos/retail-capital.svg',
    productType: 'Invoice Discounting',
    amountMin: 100000,
    amountMax: 10000000,
    minYears: 3,
    minMonthlyTurnover: 500000,
    vatRequired: true,
    speedDays: [5, 7],
    sectorExclusions: ['Hospitality'],
    notes: 'Unlock cash from outstanding invoices for established B2B companies'
  },
  {
    id: 'fundrr-wc',
    provider: 'Fundrr',
    logo: '/logos/fundrr.svg',
    productType: 'Working Capital',
    amountMin: 50000,
    amountMax: 500000,
    minYears: 2,
    minMonthlyTurnover: 150000,
    vatRequired: true,
    speedDays: [3, 5],
    notes: 'Transparent pricing with no hidden fees for working capital needs'
  },
  {
    id: 'spark-asset',
    provider: 'Spark Capital',
    logo: '/logos/spark.svg',
    productType: 'Asset Finance',
    amountMin: 500000,
    amountMax: 20000000,
    minYears: 5,
    minMonthlyTurnover: 1000000,
    vatRequired: true,
    speedDays: [10, 14],
    collateralRequired: true,
    notes: 'Equipment and vehicle financing for established businesses'
  },
  {
    id: 'grobank-term',
    provider: 'Grobank',
    logo: '/logos/grobank.svg',
    productType: 'Term Loan',
    amountMin: 1000000,
    amountMax: 50000000,
    minYears: 5,
    minMonthlyTurnover: 2000000,
    vatRequired: true,
    speedDays: [14, 21],
    collateralRequired: true,
    sectorExclusions: ['Logistics', 'Manufacturing'],
    notes: 'Traditional bank lending for qualified enterprises'
  },
  {
    id: 'payfast-mca',
    provider: 'PayFast Capital',
    logo: '/logos/payfast.svg',
    productType: 'Merchant Cash Advance',
    amountMin: 30000,
    amountMax: 300000,
    minYears: 1,
    minMonthlyTurnover: 80000,
    vatRequired: false,
    speedDays: [1, 2],
    provincesAllowed: ['Gauteng', 'Western Cape'],
    notes: 'Instant funding for PayFast merchants based on transaction history'
  },
  {
    id: 'business-partners-term',
    provider: 'Business Partners',
    logo: '/logos/business-partners.svg',
    productType: 'Term Loan',
    amountMin: 500000,
    amountMax: 15000000,
    minYears: 3,
    minMonthlyTurnover: 800000,
    vatRequired: true,
    speedDays: [21, 30],
    notes: 'Patient capital with mentorship for SME growth'
  },
  {
    id: 'finclusion-wc',
    provider: 'Finclusion',
    logo: '/logos/finclusion.svg',
    productType: 'Working Capital',
    amountMin: 100000,
    amountMax: 750000,
    minYears: 2,
    minMonthlyTurnover: 250000,
    vatRequired: false,
    speedDays: [5, 7],
    sectorExclusions: ['Retail'],
    notes: 'Digital-first lending for service and logistics businesses'
  }
];