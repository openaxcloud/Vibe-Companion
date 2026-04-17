# System Architecture

## Architecture Overview
Static site generation (SSG) pattern with build-time markdown processing, generating optimized HTML pages and RSS feeds.

## Key Technical Decisions
- **Static Generation**: Pre-build all pages for optimal performance
- **File-based Content**: Markdown files with frontmatter for post metadata
- **Component Architecture**: Reusable React components for layout and content
- **Build-time Processing**: Parse markdown and generate RSS during build

## Design Patterns
- **Content Pipeline**: Markdown → AST → HTML with syntax highlighting
- **Layout Components**: Header, Footer, PostLayout, ListLayout
- **Data Layer**: Build-time content aggregation and sorting
- **Feed Generation**: XML RSS 2.0 specification compliance

## File Structure
```
/src/content/posts/ - Markdown blog posts
/src/components/ - React components
/src/utils/ - Markdown processing utilities
/public/rss.xml - Generated RSS feed
```