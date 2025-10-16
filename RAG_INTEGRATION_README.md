# Pinecone RAG Integration for Frank

## Overview
This integration adds Retrieval-Augmented Generation (RAG) capabilities to Frank using Pinecone as the vector database. Frank can now reference external funding knowledge (guidelines, policies, FAQs) to provide more accurate and specific answers.

## Components Added

### 1. **`lib/pinecone-client.ts`**
Core Pinecone integration with:
- `upsertChunks()` - Embeds text chunks using OpenAI's `text-embedding-3-small` and stores in Pinecone
- `queryPinecone()` - Performs similarity search and returns top-K relevant chunks
- `formatRetrievedKnowledge()` - Formats results for inclusion in prompts
- `initializePinecone()` - Creates index if it doesn't exist
- `clearNamespace()` - Clears all vectors (useful for testing)

### 2. **`lib/chunker.ts`**
Document chunking utilities:
- `chunkDocument()` - Splits documents into ~500 token chunks (2000 chars)
- `chunkMarkdown()` - Preserves markdown structure while chunking
- Configurable chunk size, overlap, and sentence preservation
- Automatic metadata and ID generation

### 3. **`lib/openai-client.ts` (Modified)**
Enhanced chat flow with RAG:
- Queries Pinecone before sending to gpt-5
- Includes retrieved knowledge in system prompt
- Keeps only last 3 conversation turns when using RAG (to manage tokens)
- Graceful fallback if RAG fails

### 4. **`app/api/test-rag/route.ts`**
Test endpoint for RAG functionality:
- `GET /api/test-rag?q=query` - Test retrieval
- `GET /api/test-rag?action=init` - Initialize Pinecone index
- `GET /api/test-rag?action=seed` - Seed with sample funding data
- `GET /api/test-rag?action=clear` - Clear namespace
- `POST /api/test-rag` - Upsert custom documents

## Setup Instructions

### 1. Get a Pinecone API Key
1. Sign up at [https://app.pinecone.io/](https://app.pinecone.io/)
2. Create a new project
3. Copy your API key

### 2. Configure Environment Variables
Add to your `.env.local`:
```env
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=frank-knowledge
PINECONE_NAMESPACE=funding-knowledge
```

### 3. Initialize Pinecone Index
```bash
# Initialize the index (one-time setup)
curl "http://localhost:3001/api/test-rag?action=init"
```

### 4. Seed Sample Data
```bash
# Load sample funding knowledge
curl "http://localhost:3001/api/test-rag?action=seed"
```

## Testing the Integration

### Test Retrieval
```bash
# Query the knowledge base
curl "http://localhost:3001/api/test-rag?q=government+funding+SEFA"

# Example response:
{
  "query": "government funding SEFA",
  "resultsCount": 5,
  "results": [
    {
      "text": "SEFA provides funding from R50,000 to R15 million...",
      "score": 0.89,
      "source": "SEFA Guidelines",
      "section": "Government Funding"
    }
  ]
}
```

### Test in Chat
When Pinecone is configured, Frank will automatically:
1. Search the knowledge base for relevant information
2. Include top-5 results in the context
3. Reference specific guidelines in responses

Example:
```
User: "Tell me about SEFA funding requirements"
Frank: [With RAG] "Based on SEFA guidelines, they provide funding from R50,000 to R15 million. Requirements include: 51% South African ownership, annual turnover below R50 million, and tax compliance. The application process takes 4-6 weeks."
```

## Adding Your Own Knowledge

### Via API
```javascript
// POST to /api/test-rag
{
  "action": "upsert",
  "documents": [
    {
      "text": "Your funding document content...",
      "metadata": {
        "source": "Document Name",
        "section": "Section Name",
        "documentId": "unique-id"
      },
      "markdown": true  // Set true for markdown documents
    }
  ]
}
```

### Programmatically
```typescript
import { upsertChunks } from '@/lib/pinecone-client';
import { chunkDocument } from '@/lib/chunker';

const chunks = chunkDocument(
  "Your document text...",
  { source: "Source Name", section: "Section" }
);

await upsertChunks(chunks);
```

## How It Works

### Data Flow
1. **User Message** → Frank receives query
2. **RAG Retrieval** → Searches Pinecone for relevant chunks
3. **Context Building** → Adds retrieved knowledge to prompt
4. **gpt-5 Processing** → Generates response using both knowledge and conversation
5. **Response** → Frank provides informed answer with references

### Token Management
- Without RAG: Uses last 10 conversation turns
- With RAG: Uses last 3 turns + retrieved knowledge
- Prevents token limit issues while maintaining context

### Graceful Degradation
- If Pinecone is not configured: Works normally without RAG
- If retrieval fails: Continues with standard response
- If no relevant knowledge found: Uses general knowledge

## Sample Knowledge Included

The seed data includes:
1. **Government Funding** - SEFA guidelines and requirements
2. **Alternative Finance** - MCA, invoice financing explanations
3. **Collateral Requirements** - Types and loan-to-value ratios
4. **BEE Funding** - Special programs and benefits
5. **FAQs** - Common funding questions and answers

## Best Practices

### Document Preparation
- Keep documents focused on single topics
- Use clear headings in markdown
- Include specific requirements, timelines, and amounts
- Add metadata for source tracking

### Chunking Strategy
- Default: 2000 chars (~500 tokens) with 200 char overlap
- Adjust chunk size based on document type
- Use markdown chunking for structured documents

### Query Optimization
- Use specific keywords in queries
- Top-K default is 5 (balance between context and relevance)
- Monitor retrieval scores (>0.8 is highly relevant)

## Monitoring & Debugging

### Check RAG Status
```typescript
// In browser console
console.log('RAG Enabled:', !!process.env.PINECONE_API_KEY);
```

### View Retrieved Knowledge
Look for console logs:
- `🔍 Performing RAG retrieval for query:`
- `📚 Retrieved X relevant chunks from knowledge base`
- `⚠️ RAG retrieval failed` (if error)

### Clear and Restart
```bash
# Clear all vectors
curl "http://localhost:3001/api/test-rag?action=clear"

# Re-seed with sample data
curl "http://localhost:3001/api/test-rag?action=seed"
```

## Production Considerations

1. **API Keys**: Move to server-side environment variables
2. **Index Configuration**: Consider dedicated indexes per environment
3. **Embedding Model**: Evaluate cost vs quality tradeoffs
4. **Caching**: Implement embedding cache for common queries
5. **Rate Limiting**: Add limits to prevent abuse
6. **Monitoring**: Track retrieval performance and relevance

## Troubleshooting

### "No Pinecone API Key" Error
- Check `.env.local` has `PINECONE_API_KEY`
- Restart Next.js server after adding

### "Index not found" Error
- Run initialization: `curl "http://localhost:3001/api/test-rag?action=init"`
- Wait 1-2 minutes for index to be ready

### Low Relevance Scores
- Review document chunking strategy
- Ensure queries use similar terminology to documents
- Consider increasing chunk overlap

### Token Limit Errors
- Reduce number of retrieved chunks (default 5)
- Decrease conversation history (currently 3 turns)
- Optimize chunk size

## Future Enhancements

- [ ] Hybrid search (semantic + keyword)
- [ ] Document upload UI
- [ ] Automatic knowledge base updates
- [ ] Query expansion for better retrieval
- [ ] Relevance feedback loop
- [ ] Multi-language support