# New Agent Context System - Selection-First Lens Paradigm

This document describes the completely restructured Agent Context system that implements the selection-first lens paradigm with sophisticated context management and evidence-based answering.

## Core Principles

### 1. Selection-First Lens Paradigm
- **Primary**: Selection-first approach where users select text to get inline answer cards
- **Secondary**: Side panel for complex, multi-section questions
- **Keyboard Shortcut**: Cmd/Ctrl+K to ask without leaving the page
- **Auto-close**: ESC key closes inline cards

### 2. Evidence Granularity
- **Sentence-level anchors**: Creates `sid-<hash>` identifiers using Range API
- **Exact highlighting**: Citations highlight the exact source sentence on hover
- **Verbatim preservation**: Numbers, units, and dates are preserved exactly

### 3. Context Pack Policy
- **Viewport-first scoring**: ×3 weight for fully visible sentences, ×1 for neighbors
- **Build upward only**: Source sentence → neighbors → section gist (if needed)
- **Performance**: Indexes viewport first (2-3 screens), expands during idle

### 4. Extractive-First Answering
- **Evidence slate**: Assembles verbatim evidence before LLM generation
- **No summarization**: LLM may paraphrase around extracts but never replace numeric strings
- **Citation format**: Uses `[sid:xxxx]` format for all references

## Architecture

### Core Components

#### 1. SentenceSegmenter
- Segments document into sentences using Range API
- Creates unique sentence anchors (`sid-<hash>`)
- Analyzes metadata (numbers, units, dates, rhetorical role)
- Detects viewport visibility and neighbor relationships

#### 2. ContextPackBuilder
- Implements viewport-first scoring algorithm
- Builds context packs with primary evidence (×3 weight) and neighbor evidence (×1 weight)
- Extracts numeric facts verbatim
- Detects contradictions in content

#### 3. SelectionManager
- Handles Cmd/Ctrl+K activation
- Manages text selection events
- Generates inline answer cards automatically
- Integrates with sentence segmentation system

#### 4. ConversationManager
- Manages conversation state with new context system
- Builds prompts with evidence slate
- Handles context updates for new questions
- Integrates with context pack builder

#### 5. InlineAnswerCard
- Shows inline answers near text selections
- Displays ≤2 sentence answers with citations
- Shows confidence indicators (High/Med/Low)
- Provides follow-up questions based on rhetorical roles

#### 6. BM25Fallback
- Provides text search when embeddings unavailable
- Ensures system works without API keys
- Implements BM25 ranking algorithm
- Responds within 200ms for selection cards

## Usage

### Basic Selection Flow

1. **User selects text** on the page
2. **Presses Cmd/Ctrl+K** (or Cmd/Ctrl+K without selection)
3. **System automatically**:
   - Segments document into sentences
   - Creates sentence anchors with metadata
   - Builds context pack with viewport-first scoring
   - Generates evidence slate
   - Shows inline answer card with citations

### Inline Answer Card Features

- **Positioned near selection** with smart boundary detection
- **Citations**: `[sid:xxxx]` format that highlight source on hover
- **Confidence**: High/Medium/Low indicators
- **Follow-up questions**: 3-5 smart questions based on content
- **Numeric cards**: Special display for table/figure selections

### Context Types

- **Selection**: Text selection with immediate context
- **Viewport**: Currently visible content (×3 weight)
- **Article**: Full article content
- **Table**: Structured table data
- **Figure**: Image captions and explanatory text

## Implementation Details

### Sentence Segmentation

```typescript
const segmenter = new SentenceSegmenter();
const anchors = segmenter.segmentDocument(document, container);

// Each anchor has:
{
  id: 'sid-abc123',
  text: 'The temperature is 25°C.',
  range: Range, // DOM range for exact highlighting
  position: {
    viewport: true, // fully visible
    neighbors: [0, 2], // adjacent sentence indices
    sectionIndex: 1
  },
  metadata: {
    hasNumbers: true,
    hasUnits: true,
    hasDates: false,
    rhetoricalRole: 'evidence'
  }
}
```

### Context Pack Building

```typescript
const builder = new ContextPackBuilder(segmenter);
const contextPack = builder.buildContextPack(question, selection, container);

// Context pack contains:
{
  primaryEvidence: SentenceAnchor[], // ×3 weight (viewport)
  neighborEvidence: SentenceAnchor[], // ×1 weight (neighbors)
  sectionContext: string[], // section gists
  numericFacts: string[], // verbatim numbers/units
  confidence: 'high' | 'medium' | 'low',
  contradictions: Contradiction[]
}
```

### Evidence Slate

```typescript
const evidenceSlate = builder.buildEvidenceSlate(contextPack);

// Evidence slate for LLM:
{
  sentences: SentenceAnchor[], // all evidence sentences
  tables: TableStructure[], // structured table data
  figures: FigureContext[], // image context
  numericFacts: string[], // preserved verbatim
  confidence: 'high' | 'medium' | 'low'
}
```

## Performance Optimizations

### Viewport-First Indexing
- Indexes 2-3 screens around current viewport
- Expands during idle time
- Responds within 200ms for selection cards

### BM25 Fallback
- Works without API keys
- Fast text search using BM25 algorithm
- Maintains performance when embeddings unavailable

### Smart Caching
- Caches sentence anchors and context packs
- Reuses evidence slate when appropriate
- Minimizes redundant processing

## Reliability Features

### Confidence Indicators
- **High**: 5+ evidence sentences
- **Medium**: 2-4 evidence sentences  
- **Low**: <2 evidence sentences

### Contradiction Detection
- Identifies conflicting values for same concepts
- Shows 2-sentence contrast with citations
- Helps users spot inconsistencies

### Error Handling
- Graceful fallback to BM25 search
- Clear error messages for users
- Automatic retry mechanisms

## Language Learning Aids

### Term Cards
- Bilingual terms with IPA pronunciation
- Brief meanings and source sentences
- Add-to-review queue functionality

### Simplified English Toggle
- Rewrites selected sentences at CEFR B1/B2 level
- Preserves original meaning
- Helps with comprehension

## Reading Progress Tracking

### Understanding Path
- 8-12 key sentences identified
- 2 key tables highlighted
- Progress bar shows coverage percentage
- Tracks shortest path to understanding

### Smart Follow-up Questions
- Based on rhetorical roles (definition/claim/evidence/limitation)
- Context-aware question generation
- Helps users explore content systematically

## Migration from Old System

The new system is completely separate from the old agent context implementation:

1. **New components** replace old ones
2. **New types** define the data structures
3. **New interfaces** for all interactions
4. **Backward compatibility** maintained where possible

## Future Enhancements

### Planned Features
- Advanced contradiction detection algorithms
- Enhanced table and figure parsing
- Multi-language support for term cards
- Advanced rhetorical analysis
- Integration with external knowledge bases

### Performance Improvements
- Web Workers for sentence segmentation
- IndexedDB for anchor storage
- Lazy loading of context packs
- Advanced caching strategies

## Troubleshooting

### Common Issues

1. **Inline cards not appearing**: Check Cmd/Ctrl+K activation
2. **Citations not highlighting**: Verify sentence anchors are created
3. **Slow performance**: Check viewport indexing and BM25 fallback
4. **Missing context**: Ensure document segmentation completed

### Debug Mode

Enable debug logging to see detailed system behavior:

```typescript
// In console
localStorage.setItem('readlite_debug', 'true');
```

## API Reference

See individual component files for detailed API documentation:
- `SentenceSegmenter.ts` - Sentence segmentation and anchoring
- `ContextPackBuilder.ts` - Context pack creation and scoring
- `SelectionManager.ts` - Selection handling and inline cards
- `ConversationManager.ts` - Conversation and context management
- `InlineAnswerCard.tsx` - Inline answer card component
- `BM25Fallback.ts` - Text search fallback implementation