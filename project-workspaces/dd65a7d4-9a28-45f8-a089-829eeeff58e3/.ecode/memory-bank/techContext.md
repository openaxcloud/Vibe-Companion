# Technical Context

## Tech Stack
- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with custom syntax highlighting themes
- **Markdown Processing**: remark + rehype ecosystem
- **Syntax Highlighting**: Prism.js with custom theme support
- **RSS Generation**: feed library for RSS 2.0 compliance
- **Routing**: React Router for client-side navigation

## Key Dependencies
```json
"remark": "^15.0.0",
"rehype-highlight": "^6.0.0", 
"prismjs": "^1.29.0",
"feed": "^4.2.2",
"gray-matter": "^4.0.3"
```

## Development Setup
- Node.js 18+ required
- `npm run dev` - Development server with hot reload
- `npm run build` - Production build with RSS generation
- `npm run preview` - Preview production build locally

## Environment Variables
```
VITE_SITE_URL=https://yourblog.com
VITE_SITE_TITLE=Your Blog Name
VITE_AUTHOR_NAME=Your Name
```