# System Architecture

## Architecture Overview
Static site generation (SSG) architecture using React with TypeScript, processing markdown files at build time to generate optimized HTML pages with embedded syntax highlighting.

## Key Technical Decisions
- **Static Generation**: Pre-render all content at build time for maximum performance
- **File-based CMS**: Markdown files in `/content` directory for version control integration
- **Component-based**: Reusable React components for post layout, code blocks, and navigation
- **Build-time Processing**: Transform markdown to HTML with syntax highlighting during build

## Design Patterns
- **Provider Pattern**: Theme and RSS context providers for global state
- **HOC Pattern**: WithSyntaxHighlighting wrapper for code components
- **Factory Pattern**: Post processor factory for different content types
- **Observer Pattern**: RSS feed regeneration on content changes

## Data Flow
1. Markdown files → Build process → Parsed content with metadata
2. Syntax highlighter processes code blocks → Styled HTML output
3. RSS generator aggregates posts → XML feed generation
4. Static pages generated with embedded highlighted code