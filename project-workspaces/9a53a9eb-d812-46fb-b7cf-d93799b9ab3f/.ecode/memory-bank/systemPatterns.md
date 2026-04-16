# System Architecture

## Architecture Overview
Static site generation with React components, markdown processing pipeline, and build-time RSS generation.

## Key Technical Decisions
- **Static Generation**: Pre-build all pages for maximum performance
- **File-based Routing**: Markdown files determine URL structure
- **Build-time Processing**: Parse markdown and generate RSS during build
- **Component-based Rendering**: Reusable React components for consistent UI

## Design Patterns
- **Content Pipeline**: Markdown → Frontmatter parsing → HTML generation → React hydration
- **Plugin Architecture**: Extensible markdown processing with remark/rehype plugins
- **Theme System**: CSS custom properties for dark/light mode switching
- **SEO Integration**: Automatic meta tag generation from frontmatter

## Data Flow
1. Markdown files in `/content` directory
2. Build process parses frontmatter and content
3. Generate static pages and RSS feed
4. Client-side hydration for interactivity