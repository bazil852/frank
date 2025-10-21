import { NextRequest, NextResponse } from 'next/server';
import { getLendersFromDB } from '@/lib/db-lenders';
import { upsertChunks } from '@/lib/pinecone-server';
import { chunkDocument } from '@/lib/chunker';

export async function POST(req: NextRequest) {
  try {
    console.log('🔄 Starting lender data migration from Supabase to Pinecone...');

    const lenders = await getLendersFromDB();
    console.log(`📊 Found ${lenders.length} lenders in Supabase`);
    
    if (lenders.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No lenders found in Supabase database'
      });
    }

    const allChunks = [];

    for (const lender of lenders) {
      const lenderDescription = [
        `# ${lender.provider} - ${lender.productType}`,
        '',
        '## Funding Details',
        `- **Amount Range**: R${(lender.amountMin / 1000).toFixed(0)}k to R${(lender.amountMax / 1000).toFixed(0)}k`,
        `- **Product Type**: ${lender.productType}`,
        `- **Speed**: ${lender.speedDays[0]} to ${lender.speedDays[1]} days for funding`,
        lender.interestRate ? `- **Interest Rate**: ${lender.interestRate[0]}% to ${lender.interestRate[1]}% annually` : '',
        '',
        '## Requirements',
        `- **Minimum Trading Years**: ${lender.minYears} years`,
        `- **Minimum Monthly Turnover**: R${(lender.minMonthlyTurnover / 1000).toFixed(0)}k per month`,
        `- **VAT Registration**: ${lender.vatRequired ? 'Required' : 'Not required'}`,
        lender.collateralRequired ? '- **Collateral**: Required' : '- **Collateral**: Not required',
        '',
        lender.provincesAllowed ? '## Geographic Coverage' : '## Geographic Coverage',
        lender.provincesAllowed ? `Available in: ${lender.provincesAllowed.join(', ')}` : 'Available nationwide',
        '',
        lender.sectorExclusions ? '## Sector Exclusions' : '',
        lender.sectorExclusions ? `Not available for: ${lender.sectorExclusions.join(', ')}` : '',
        lender.sectorExclusions ? '' : '',
        lender.notes ? '## Additional Notes' : '',
        lender.notes ? lender.notes : '',
        lender.notes ? '' : '',
        '## Summary',
        `${lender.provider} offers ${lender.productType.toLowerCase()} funding from R${(lender.amountMin / 1000).toFixed(0)}k to R${(lender.amountMax / 1000).toFixed(0)}k for businesses trading for ${lender.minYears}+ years with R${(lender.minMonthlyTurnover / 1000).toFixed(0)}k+ monthly turnover. Funding available in ${lender.speedDays[0]}-${lender.speedDays[1]} days.`
      ].filter(line => line !== '').join('\n');

      const chunks = chunkDocument(
        lenderDescription,
        {
          source: `${lender.provider} Lender Profile`,
          section: lender.productType,
          documentId: lender.id,
          provider: lender.provider,
          productType: lender.productType,
          amountMin: lender.amountMin,
          amountMax: lender.amountMax,
          minYears: lender.minYears,
          minMonthlyTurnover: lender.minMonthlyTurnover,
          vatRequired: lender.vatRequired,
          speedDaysMin: lender.speedDays[0],
          speedDaysMax: lender.speedDays[1],
          collateralRequired: lender.collateralRequired || false
        },
        {
          chunkSize: 1500,
          overlap: 150,
          preserveSentences: true
        }
      );
      
      allChunks.push(...chunks);
      console.log(`✅ Created ${chunks.length} chunks for ${lender.provider}`);
    }
    
    console.log(`📦 Total chunks created: ${allChunks.length}`);

    console.log('⬆️ Uploading chunks to Pinecone...');
    await upsertChunks(allChunks);
    
    return NextResponse.json({
      success: true,
      message: 'Lender data migration completed successfully',
      stats: {
        lendersProcessed: lenders.length,
        chunksCreated: allChunks.length,
        avgChunksPerLender: Math.round(allChunks.length / lenders.length)
      }
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'POST to this endpoint to migrate lender data from Supabase to Pinecone',
    usage: 'curl -X POST http:
  });
}