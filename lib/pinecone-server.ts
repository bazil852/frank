// Server-side only Pinecone client
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

// Server-side OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Server-side Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

export interface QueryResult {
  text: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface ChunkData {
  id: string;
  text: string;
  metadata?: {
    source?: string;
    section?: string;
    [key: string]: any;
  };
}

class PineconeServerRAG {
  private indexName: string;
  private namespace: string;

  constructor() {
    this.indexName = process.env.PINECONE_INDEX || 'frank-funding';
    this.namespace = process.env.PINECONE_NAMESPACE || 'funding-knowledge';
  }

  /**
   * Generate embeddings using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for embeddings');
    }
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  }

  /**
   * Query Pinecone for similar documents
   */
  async queryPinecone(query: string, topK: number = 5): Promise<QueryResult[]> {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is required for querying');
    }
    
    // Generate embedding for the query
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Query Pinecone
    const index = pinecone.Index(this.indexName);
    const results = await index.namespace(this.namespace).query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });
    
    // Format results
    const formattedResults: QueryResult[] = results.matches?.map(match => ({
      text: match.metadata?.text as string || '',
      score: match.score || 0,
      metadata: match.metadata || {},
    })) || [];
    
    return formattedResults;
  }

  /**
   * Upsert chunks to Pinecone
   */
  async upsertChunks(chunks: ChunkData[]): Promise<void> {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is required for upserting chunks');
    }
    
    const index = pinecone.Index(this.indexName);
    
    // Process chunks in batches
    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      // Generate embeddings for the batch
      const embeddings = await Promise.all(
        batch.map(chunk => this.generateEmbedding(chunk.text))
      );
      
      // Prepare vectors for upsert
      const vectors = batch.map((chunk, idx) => ({
        id: chunk.id,
        values: embeddings[idx],
        metadata: {
          text: chunk.text,
          ...chunk.metadata,
        },
      }));
      
      // Upsert to Pinecone
      await index.namespace(this.namespace).upsert(vectors);
      
      console.log(`Upserted batch ${i / batchSize + 1} of ${Math.ceil(chunks.length / batchSize)}`);
    }
    
    console.log(`Successfully upserted ${chunks.length} chunks to Pinecone`);
  }

  /**
   * Clear namespace
   */
  async clearNamespace(): Promise<void> {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is required for clearing namespace');
    }
    
    const index = pinecone.Index(this.indexName);
    await index.namespace(this.namespace).deleteAll();
    console.log(`Cleared all vectors in namespace: ${this.namespace}`);
  }

  /**
   * Check if index exists
   */
  async checkIndex(): Promise<boolean> {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is required');
    }
    
    const indexList = await pinecone.listIndexes();
    return indexList.indexes?.some(idx => idx.name === this.indexName) || false;
  }

  /**
   * Format retrieved knowledge for inclusion in prompt
   */
  formatRetrievedKnowledge(results: QueryResult[]): string {
    if (results.length === 0) {
      return 'No relevant knowledge found.';
    }
    
    return results
      .map((result, idx) => {
        const source = result.metadata?.source || 'Unknown Source';
        const section = result.metadata?.section || '';
        const header = section ? `[${source} - ${section}]` : `[${source}]`;
        
        return `${idx + 1}. ${header} (Relevance: ${(result.score * 100).toFixed(1)}%)
${result.text}`;
      })
      .join('\n\n');
  }
}

// Export singleton instance
const pineconeServerRAG = new PineconeServerRAG();

// Export functions
export const queryPinecone = (query: string, topK?: number) => 
  pineconeServerRAG.queryPinecone(query, topK);

export const upsertChunks = (chunks: ChunkData[]) => 
  pineconeServerRAG.upsertChunks(chunks);

export const formatRetrievedKnowledge = (results: QueryResult[]) => 
  pineconeServerRAG.formatRetrievedKnowledge(results);

export const clearNamespace = () => 
  pineconeServerRAG.clearNamespace();

export const checkIndex = () => 
  pineconeServerRAG.checkIndex();