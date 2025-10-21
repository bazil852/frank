
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

let pinecone: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY is not configured');
  }

  if (!pinecone) {
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }

  return pinecone;
}

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

  async queryPinecone(query: string, topK: number = 5): Promise<QueryResult[]> {
    const client = getPineconeClient();

    const queryEmbedding = await this.generateEmbedding(query);

    const index = client.Index(this.indexName);
    const results = await index.namespace(this.namespace).query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    const formattedResults: QueryResult[] = results.matches?.map(match => ({
      text: match.metadata?.text as string || '',
      score: match.score || 0,
      metadata: match.metadata || {},
    })) || [];

    return formattedResults;
  }

  async upsertChunks(chunks: ChunkData[]): Promise<void> {
    const client = getPineconeClient();
    const index = client.Index(this.indexName);

    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      const embeddings = await Promise.all(
        batch.map(chunk => this.generateEmbedding(chunk.text))
      );

      const vectors = batch.map((chunk, idx) => ({
        id: chunk.id,
        values: embeddings[idx],
        metadata: {
          text: chunk.text,
          ...chunk.metadata,
        },
      }));

      await index.namespace(this.namespace).upsert(vectors);
      
      console.log(`Upserted batch ${i / batchSize + 1} of ${Math.ceil(chunks.length / batchSize)}`);
    }
    
    console.log(`Successfully upserted ${chunks.length} chunks to Pinecone`);
  }

  async clearNamespace(): Promise<void> {
    const client = getPineconeClient();
    const index = client.Index(this.indexName);
    await index.namespace(this.namespace).deleteAll();
    console.log(`Cleared all vectors in namespace: ${this.namespace}`);
  }

  async checkIndex(): Promise<boolean> {
    const client = getPineconeClient();
    const indexList = await client.listIndexes();
    return indexList.indexes?.some(idx => idx.name === this.indexName) || false;
  }

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

const pineconeServerRAG = new PineconeServerRAG();

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