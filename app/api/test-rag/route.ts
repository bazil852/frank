import { NextRequest, NextResponse } from 'next/server';
import { 
  queryPinecone, 
  formatRetrievedKnowledge,
  upsertChunks,
  clearNamespace,
  checkIndex
} from '@/lib/pinecone-server';
import { chunkDocument, chunkMarkdown } from '@/lib/chunker';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');
    const action = searchParams.get('action');

    if (action === 'init') {
      
      const exists = await checkIndex();
      return NextResponse.json({ 
        success: true, 
        message: exists ? 'Pinecone index exists and ready' : 'Pinecone index not found',
        indexExists: exists
      });
    }
    
    if (action === 'clear') {
      
      await clearNamespace();
      return NextResponse.json({ 
        success: true, 
        message: 'Namespace cleared' 
      });
    }
    
    if (action === 'seed') {
      
      const sampleDocuments = [
        {
          text: `# Government Funding Programs

## SEFA (Small Enterprise Finance Agency)
SEFA provides funding from R50,000 to R15 million for SMEs in South Africa. 
Requirements:
- Business must be 51% South African owned
- Must operate in South Africa
- Annual turnover below R50 million
- Business must be registered and tax compliant
- Funding types include term loans, revolving credit, and asset finance

Application process takes 4-6 weeks. Interest rates range from prime to prime + 6%.`,
          metadata: {
            source: 'SEFA Guidelines',
            section: 'Government Funding',
            documentId: 'sefa-001',
          }
        },
        {
          text: `# Alternative Finance Options

## Merchant Cash Advances (MCA)
MCAs provide quick funding against future credit card sales.
- Funding: R50,000 to R5 million
- Approval: 24-48 hours
- Requirements: 6+ months trading, R50k+ monthly card sales
- Repayment: Daily or weekly as percentage of sales
- Factor rate: 1.2 to 1.5 (not annual interest)

Best for: Retail, restaurants, and businesses with consistent card sales
Avoid if: You have seasonal business or low profit margins`,
          metadata: {
            source: 'Alternative Finance Guide',
            section: 'MCA Overview',
            documentId: 'alt-finance-001',
          }
        },
        {
          text: `# Invoice Financing FAQ

Q: What is invoice financing?
A: Invoice financing allows you to borrow against outstanding invoices, getting 70-85% of the invoice value upfront.

Q: Who qualifies?
A: Businesses with B2B sales, reliable debtors, and invoices typically 30-90 days.

Q: What are the costs?
A: Typically 1-3% of invoice value per month, depending on debtor quality and payment terms.

Q: How fast is funding?
A: Initial setup takes 5-7 days, then 24-48 hours per invoice thereafter.`,
          metadata: {
            source: 'Funding FAQs',
            section: 'Invoice Financing',
            documentId: 'faq-001',
          }
        },
        {
          text: `# Collateral Requirements

## Types of Acceptable Collateral
1. **Property**: Commercial or residential property with clear title
2. **Vehicles**: Cars, trucks, or equipment less than 7 years old
3. **Equipment**: Industrial machinery, IT equipment, medical equipment
4. **Inventory**: Stock with stable value and demand
5. **Guarantees**: Personal surety or corporate guarantees

## Loan-to-Value Ratios
- Property: Up to 70% of market value
- Vehicles: Up to 60% of trade value
- Equipment: Up to 50% of book value
- Inventory: Up to 40% of cost value`,
          metadata: {
            source: 'Lending Requirements',
            section: 'Collateral',
            documentId: 'req-001',
          }
        },
        {
          text: `# BEE Funding Advantages

Black Economic Empowerment (BEE) status can unlock additional funding:

## Level 1-4 BEE Benefits:
- Access to government-backed loans at prime - 2%
- Larger funding amounts (up to 30% more)
- Reduced collateral requirements
- Fast-track approval processes
- Access to grant funding for training and development

## Special Programs:
- Youth funding (18-35 years): Up to R1 million at reduced rates
- Women-owned businesses: 60% funding with 40% grant component
- Township businesses: Special development finance rates`,
          metadata: {
            source: 'BEE Funding Guide',
            section: 'BEE Benefits',
            documentId: 'bee-001',
          }
        }
      ];

      const allChunks = [];
      for (const doc of sampleDocuments) {
        const chunks = chunkMarkdown(doc.text, doc.metadata, {
          chunkSize: 1500,
          overlap: 200
        });
        allChunks.push(...chunks);
      }

      await upsertChunks(allChunks);
      
      return NextResponse.json({ 
        success: true, 
        message: `Seeded ${allChunks.length} chunks from ${sampleDocuments.length} documents`,
        chunks: allChunks.length
      });
    }

    if (!query) {
      return NextResponse.json({ 
        error: 'Missing query parameter. Use ?q=your+query or ?action=init|clear|seed' 
      }, { status: 400 });
    }

    console.log('Querying Pinecone for:', query);
    const results = await queryPinecone(query, 5);

    const formattedKnowledge = formatRetrievedKnowledge(results);
    
    return NextResponse.json({
      query,
      resultsCount: results.length,
      results: results.map(r => ({
        text: r.text.substring(0, 200) + '...',
        score: r.score,
        source: r.metadata?.source,
        section: r.metadata?.section
      })),
      formattedKnowledge
    });
    
  } catch (error) {
    console.error('Test RAG API error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { documents, action } = body;
    
    if (action === 'upsert' && documents) {
      
      const allChunks = [];
      
      for (const doc of documents) {
        const chunks = doc.markdown 
          ? chunkMarkdown(doc.text, doc.metadata)
          : chunkDocument(doc.text, doc.metadata);
        allChunks.push(...chunks);
      }
      
      await upsertChunks(allChunks);
      
      return NextResponse.json({
        success: true,
        message: `Upserted ${allChunks.length} chunks from ${documents.length} documents`,
        chunks: allChunks.length
      });
    }
    
    return NextResponse.json({ 
      error: 'Invalid request. Provide documents array with action=upsert' 
    }, { status: 400 });
    
  } catch (error) {
    console.error('Test RAG POST error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}