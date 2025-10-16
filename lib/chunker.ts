import { ChunkData } from './pinecone-server';

export interface ChunkerOptions {
  chunkSize?: number; // Target size in characters (roughly 500 tokens = ~2000 chars)
  overlap?: number; // Number of characters to overlap between chunks
  preserveSentences?: boolean; // Try to break at sentence boundaries
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
    chunkSize: 2000, // ~500 tokens
    overlap: 200,
    preserveSentences: true,
  };

  /**
   * Split a document into chunks suitable for embedding
   */
  chunkDocument(
    text: string,
    metadata: DocumentMetadata,
    options?: ChunkerOptions
  ): ChunkData[] {
    const opts = { ...this.defaultOptions, ...options };
    
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Clean the text
    const cleanedText = this.cleanText(text);
    
    // Split into chunks
    const chunks = opts.preserveSentences
      ? this.chunkBySentences(cleanedText, opts)
      : this.chunkBySize(cleanedText, opts);
    
    // Add metadata and generate IDs
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

  /**
   * Chunk multiple documents at once
   */
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

  /**
   * Clean text by normalizing whitespace and removing excessive line breaks
   */
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Normalize line breaks
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s+/g, '\n') // Remove leading spaces after line breaks
      .trim();
  }

  /**
   * Chunk text while trying to preserve sentence boundaries
   */
  private chunkBySentences(
    text: string,
    opts: Required<ChunkerOptions>
  ): string[] {
    const chunks: string[] = [];
    
    // Split by sentence-ending punctuation
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';
    let lastOverlapText = '';
    
    for (const sentence of sentences) {
      const sentenceTrimmed = sentence.trim();
      
      // If adding this sentence would exceed chunk size
      if (currentChunk.length + sentenceTrimmed.length > opts.chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Create overlap from the end of the current chunk
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
    
    // Add the last chunk if it's not empty
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * Simple chunking by character size
   */
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

  /**
   * Generate a unique ID for a chunk
   */
  private generateChunkId(source: string, index: number): string {
    const timestamp = Date.now();
    const sourceSlug = source
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 50);
    return `${sourceSlug}-${timestamp}-${index}`;
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokenCount(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Split markdown documents while preserving structure
   */
  chunkMarkdown(
    markdown: string,
    metadata: DocumentMetadata,
    options?: ChunkerOptions
  ): ChunkData[] {
    const opts = { ...this.defaultOptions, ...options };
    
    // Split by headers to maintain context
    const sections = markdown.split(/^(#{1,3}\s+.+)$/gm);
    const chunks: ChunkData[] = [];
    
    let currentSection = '';
    let currentHeader = '';
    
    for (let i = 0; i < sections.length; i++) {
      const part = sections[i].trim();
      
      if (part.match(/^#{1,3}\s+/)) {
        // This is a header
        if (currentSection && currentSection.length > opts.chunkSize / 2) {
          // Process the previous section
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
    
    // Process the last section
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

// Export singleton instance for convenience
export const chunker = new DocumentChunker();

// Export convenience functions
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