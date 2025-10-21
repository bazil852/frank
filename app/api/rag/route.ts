import { NextRequest, NextResponse } from 'next/server';
import { 
  queryPinecone, 
  formatRetrievedKnowledge
} from '@/lib/pinecone-server';

export async function POST(req: NextRequest) {
  try {
    const { query, topK = 5 } = await req.json();
    
    if (!query) {
      return NextResponse.json({ 
        error: 'Query is required' 
      }, { status: 400 });
    }

    const results = await queryPinecone(query, topK);
    const formattedKnowledge = formatRetrievedKnowledge(results);
    
    return NextResponse.json({
      success: true,
      query,
      resultsCount: results.length,
      formattedKnowledge,
      results: results.map(r => ({
        text: r.text.substring(0, 200) + (r.text.length > 200 ? '...' : ''),
        score: r.score,
        source: r.metadata?.source,
        section: r.metadata?.section
      }))
    });
    
  } catch (error) {
    console.error('RAG API error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'RAG retrieval failed' 
    }, { status: 500 });
  }
}