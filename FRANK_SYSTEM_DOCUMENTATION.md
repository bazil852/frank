# Frank MVP - System Architecture & Data Flow Documentation

## Overview
Frank is an AI-powered SME funding assistant that matches South African businesses with appropriate financing providers using intelligent filtering and gpt-5 conversation capabilities.

## System Architecture

### Core Components
1. **Frontend**: Next.js 14 SPA with dual input modes (chat/form)
2. **AI Engine**: OpenAI gpt-5 for conversation and data extraction
3. **Database**: Supabase PostgreSQL for lender data and user tracking
4. **Matching Engine**: Rule-based filtering with intelligent scoring

## Data Flow & Processing Pipeline

### 1. Data Sources

#### Lender Database (Supabase)
Frank fetches lender data from the `lenders` table with the following schema:
```sql
lenders {
  id: string
  provider: string
  logo: string
  product_type: enum
  amount_min: number
  amount_max: number
  min_years: number
  min_monthly_turnover: number
  vat_required: boolean
  provinces_allowed: string[]
  sector_exclusions: string[]
  speed_days_min: number
  speed_days_max: number
  collateral_required: boolean
  notes: string
}
```

#### Static Fallback Data
- Located in `lib/catalog.ts`
- Contains 10 pre-configured lenders as backup
- Used when database is unavailable

### 2. User Profile Data Structure

```typescript
Profile = {
  industry?: string
  yearsTrading?: number
  monthlyTurnover?: number
  vatRegistered?: boolean
  amountRequested?: number
  useOfFunds?: string
  urgencyDays?: number
  province?: string
  collateralAcceptable?: boolean
  contact?: { name, email, phone }
}
```

### 3. Data Processing Pipeline

#### Step 1: User Input → AI Extraction
**Location**: `lib/openai-client.ts:292` (`FrankAI.chat`)

1. **Input Processing**:
   - User message (chat) or form data
   - Chat history for context
   - Current profile state

2. **AI Data Extraction**:
   - gpt-5 processes natural language
   - Extracts structured business data
   - Updates user profile incrementally

3. **Extraction Fields**:
   ```typescript
   extracted: {
     industry: string
     monthlyTurnover: number
     amountRequested: number
     yearsTrading: number
     vatRegistered: boolean
     useOfFunds: string
     urgencyDays: number
     province: string
     collateralAcceptable: boolean
   }
   ```

#### Step 2: Profile → Lender Matching
**Location**: `lib/filters.ts:33` (`filterProducts`)

**Matching Logic**:
```typescript
filterProducts(profile: Profile, products: Product[]) → {
  qualified: Product[]
  notQualified: FilteredProduct[]
  needMoreInfo: NeedMoreInfoProduct[]
}
```

**Classification Rules**:

1. **Hard Requirements** (Automatic Disqualification):
   - `yearsTrading < product.minYears`
   - `monthlyTurnover < product.minMonthlyTurnover` (>25% shortfall)
   - `amountRequested` outside product range (>20% variance)
   - Industry in `sectorExclusions`
   - Province not in `provincesAllowed`
   - `vatRequired = true` but `vatRegistered = false`

2. **Qualified Matches**:
   - All hard requirements met
   - No blocking issues
   - Scored by amount fit, urgency match, turnover ratio

3. **Need More Info**:
   - Missing critical profile data
   - Minor requirement gaps (≤25% shortfall)
   - Collateral requirements unclear

4. **Not Qualified**:
   - Multiple hard blockers
   - Significant requirement gaps

#### Step 3: Response Generation
**Location**: `lib/openai-client.ts` (system prompt & response formatting)

**3-Layer Response Structure**:
1. **React/Acknowledge**: Sassy, human-like reaction
2. **Context/Insight**: Explain current status and matches
3. **Next Steps**: 2-3 actionable options

## AI Conversation System

### System Prompt Architecture
**Location**: `lib/openai-client.ts:35`

**Key Directives**:
- 3-layer message structure for multi-bubble display
- Personality: Short, punchy, cheeky but never rude
- Context-aware match referencing
- Product education with analogies
- Always end with actionable options

### Conversation Flow States

1. **Initial Contact**: Gather basic business info
   ```
   User: "I need funding"
   Frank: "Need cash? Cool. What's your business and how much?"
   ```

2. **Information Gathering**: Extract profile data
   ```
   Frank: "R300k/month in 10 months? Not bad — you're cooking."
   ```

3. **Match Presentation**: Show results with context
   ```
   Frank: "You've got 6 lenders ready to fund you, up to R2M, 
          cash in 24 hours. 5 others might join if we confirm VAT."
   ```

### Response Context Building

**Current Match Results** (when available):
```typescript
matchContext = {
  qualified: string[]           // Lender names
  qualifiedCount: number
  qualifiedDetails: string[]    // Amounts, speed, rates
  notQualified: string[]       // With rejection reasons
  needMoreInfo: string[]       // With requirements
}
```

**Profile Awareness**:
- Never ask for data already collected
- Reference profile changes conversationally
- Surface relevant lender details (speed, rates, terms)

## Scoring & Ranking Algorithm

### Qualified Lender Scoring
**Location**: `lib/filters.ts:143`

```typescript
score = 1.0
- (amount position penalty: 0.1)
- (urgency mismatch penalty: 0.1)  
- (low turnover ratio penalty: 0.05)
```

**Sort Priority**:
1. Score (descending)
2. Speed (ascending - faster first)

### Match Quality Indicators

1. **Perfect Match**: No issues, good score
2. **Close Match**: Minor improvements needed (≤25% gaps)
3. **Potential Match**: Missing information but viable
4. **Poor Match**: Multiple blockers or major gaps

## Error Handling & Fallbacks

### AI Service Failures
- **No API Key**: Falls back to deterministic extraction
- **API Errors**: Returns generic responses
- **Parsing Failures**: Uses fallback rationales

### Database Failures
- **Lender Fetch Error**: Falls back to static catalog
- **Profile Save Error**: Continues with local state
- **Conversation Tracking**: Graceful degradation

### Response Fallbacks
```typescript
// Primary: gpt-5 response
// Fallback 1: "Got it — I'll tune your matches"
// Fallback 2: "Sorry, I encountered an error"
```

## Performance Optimizations

### Caching Strategy
- **Products**: Fetched once on mount, cached in state
- **Profile**: Persisted to Supabase for session continuity
- **Match Results**: Debounced recalculation (250ms)

### AI Optimization
- **Context Limitation**: Last 10 chat messages only
- **Token Management**: Max 300 tokens per response
- **Temperature**: 0.1 for consistent extraction
- **Rationale Caching**: Temporarily disabled to reduce API calls

## Key Integration Points

### Database Integration
```typescript
// Fetch lenders
getLendersFromDB() → Product[]

// Save user profile  
ConversationTracker.updateUserBusinessProfile(profile)

// Track events
trackEvent('profile_updated', context)
```

### UI State Management
```typescript
// Profile updates trigger re-matching
updateProfile(updates) → setMatches(filterProducts(profile, products))

// Match counts drive UI visibility
hasUserInput = keyFields.filter(exists).length >= 3
```

### Real-time Updates
- Profile changes → immediate re-filtering
- Match results → animated transitions
- Chat responses → streaming display (when enabled)

## Security & Privacy

### Data Handling
- **Anonymous Tracking**: User ID generated client-side
- **Profile Persistence**: Business data only, no PII required
- **API Key**: Client-side usage (not recommended for production)

### Input Validation
- **Amount Ranges**: Validated against reasonable business limits
- **Required Fields**: Enforced through UI and backend
- **Injection Protection**: JSON-only API responses

This architecture ensures Frank provides intelligent, context-aware funding recommendations while maintaining performance and user experience quality.