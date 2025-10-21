import { ChunkData } from './pinecone-server';

export interface ChunkerOptions {
  chunkSize?: number; 
  overlap?: number; 
  preserveSentences?: boolean; 
}

export interface DocumentMetadata {
  source: string;
  section?: string;
  documentId?: string;
  createdAt?: string;
  [key: string]: any;
}

export class DocumentChunker {
  private readonly defaultOptions: Required<ChunkerOptions> = {
    chunkSize: 2000, 
    overlap: 200,
    preserveSentences: true,
  };

  chunkDocument(
    text: string,
    metadata: DocumentMetadata,
    options?: ChunkerOptions
  ): ChunkData[] {
    const opts = { ...this.defaultOptions, ...options };
    
    if (!text || text.trim().length === 0) {
      return [];
    }

    const cleanedText = this.cleanText(text);

    const chunks = opts.preserveSentences
      ? this.chunkBySentences(cleanedText, opts)
      : this.chunkBySize(cleanedText, opts);

    return chunks.map((chunk, index) => ({
      id: this.generateChunkId(metadata.source, index),
      text: chunk,
      metadata: {
        ...metadata,
        chunkIndex: index,
        totalChunks: chunks.length,
      },
    }));
  }

  chunkDocuments(
    documents: Array<{ text: string; metadata: DocumentMetadata }>,
    options?: ChunkerOptions
  ): ChunkData[] {
    const allChunks: ChunkData[] = [];
    
    for (const doc of documents) {
      const chunks = this.chunkDocument(doc.text, doc.metadata, options);
      allChunks.push(...chunks);
    }
    
    return allChunks;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') 
      .replace(/\n{3,}/g, '\n\n') 
      .replace(/\s+/g, ' ') 
      .replace(/\n\s+/g, '\n') 
      .trim();
  }

  private chunkBySentences(
    text: string,
    opts: Required<ChunkerOptions>
  ): string[] {
    const chunks: string[] = [];

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';
    let lastOverlapText = '';
    
    for (const sentence of sentences) {
      const sentenceTrimmed = sentence.trim();

      if (currentChunk.length + sentenceTrimmed.length > opts.chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());

        if (opts.overlap > 0) {
          const overlapSentences = currentChunk.split(/[.!?]+/).slice(-2).join('. ');
          lastOverlapText = overlapSentences.slice(-opts.overlap);
          currentChunk = lastOverlapText + ' ' + sentenceTrimmed;
        } else {
          currentChunk = sentenceTrimmed;
        }
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentenceTrimmed;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  private chunkBySize(
    text: string,
    opts: Required<ChunkerOptions>
  ): string[] {
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + opts.chunkSize, text.length);
      chunks.push(text.slice(start, end).trim());
      start = end - opts.overlap;
    }
    
    return chunks.filter(chunk => chunk.length > 0);
  }

  private generateChunkId(source: string, index: number): string {
    const timestamp = Date.now();
    const sourceSlug = source
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 50);
    return `${sourceSlug}-${timestamp}-${index}`;
  }

  estimateTokenCount(text: string): number {
    
    return Math.ceil(text.length / 4);
  }

  chunkMarkdown(
    markdown: string,
    metadata: DocumentMetadata,
    options?: ChunkerOptions
  ): ChunkData[] {
    const opts = { ...this.defaultOptions, ...options };

    const sections = markdown.split(/^(#{1,3}\s+.+)$/gm);
    const chunks: ChunkData[] = [];
    
    let currentSection = '';
    let currentHeader = '';
    
    for (let i = 0; i < sections.length; i++) {
      const part = sections[i].trim();
      
      if (part.match(/^#{1,3}\s+/)) {
        
        if (currentSection && currentSection.length > opts.chunkSize / 2) {
          
          const sectionChunks = this.chunkDocument(
            currentSection,
            {
              ...metadata,
              section: currentHeader || 'Introduction',
            },
            opts
          );
          chunks.push(...sectionChunks);
          currentSection = '';
        }
        currentHeader = part.replace(/^#+\s+/, '');
        currentSection += part + '\n\n';
      } else if (part) {
        currentSection += part + '\n\n';
      }
    }

    if (currentSection.trim()) {
      const sectionChunks = this.chunkDocument(
        currentSection,
        {
          ...metadata,
          section: currentHeader || 'Content',
        },
        opts
      );
      chunks.push(...sectionChunks);
    }
    
    return chunks;
  }
}

export const chunker = new DocumentChunker();

export const chunkDocument = (
  text: string,
  metadata: DocumentMetadata,
  options?: ChunkerOptions
) => chunker.chunkDocument(text, metadata, options);

export const chunkDocuments = (
  documents: Array<{ text: string; metadata: DocumentMetadata }>,
  options?: ChunkerOptions
) => chunker.chunkDocuments(documents, options);

export const chunkMarkdown = (
  markdown: string,
  metadata: DocumentMetadata,
  options?: ChunkerOptions
) => chunker.chunkMarkdown(markdown, metadata, options);