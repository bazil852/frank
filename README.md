# Frank MVP - Business Financing Matcher

**Frank**: AI-powered SME funding assistant that matches South African businesses with the right financing providers using smart filtering and GPT-4o.

## Features

- **Dual Input Modes**: Form-based structured input or conversational chat interface
- **Smart Filtering**: Real-time matching based on business profile against 10+ SA lenders
- **Live Updates**: Animated transitions and real-time filter updates
- **GPT Integration**: AI-powered matching rationales and business detail extraction
- **Apply Flow**: Complete application submission workflow with success states

## Quick Start

```bash
# Install dependencies
pnpm i

# Set up environment (optional for GPT features)
# Add your OpenAI API key to .env.local:
# OPENAI_API_KEY=your_key_here

# Run development server
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001)

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **LLM**: OpenAI GPT-4o

## Project Structure

```
app/
├── page.tsx           # Main single-page application
├── api/
│   ├── gpt/route.ts   # GPT integration endpoint
│   └── apply/route.ts # Application submission handler
lib/
├── catalog.ts         # Static product/lender data
└── filters.ts         # Filtering and scoring logic
components/            # Reusable UI components
public/logos/          # Provider logo SVGs
```

## How Frank Works

1. **Chat or Form**: Users describe their business needs via chat or structured form
2. **Smart Extraction**: GPT-4o extracts business details (industry, amount, turnover, etc.)
3. **Rule-Based Filtering**: Algorithm matches against lender requirements
4. **AI Rationales**: GPT generates personalized reasons why each lender fits
5. **Apply Flow**: Complete application with contact details and success tracking

## Environment Variables

- `OPENAI_API_KEY`: Optional. If not provided, the app uses fallback responses.

## License

MIT# frank
