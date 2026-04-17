# Technical Context

## Tech Stack
- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and building
- **Styling**: Tailwind CSS for utility-first styling
- **Markdown**: remark/rehype ecosystem for processing
- **Syntax Highlighting**: Prism.js or Shiki
- **RSS Generation**: Custom XML generation utility

## Key Dependencies
```json
{
  "react": "^18.0.0",
  "typescript": "^5.0.0",
  "vite": "^4.0.0",
  "tailwindcss": "^3.0.0",
  "remark": "^14.0.0",
  "rehype-highlight": "^6.0.0",
  "gray-matter": "^4.0.0"
}
```

## Environment Variables
```
VITE_SITE_URL=https://yourblog.com
VITE_SITE_TITLE=Your Blog Name
VITE_SITE_DESCRIPTION=Blog description
VITE_AUTHOR_NAME=Your Name
VITE_AUTHOR_EMAIL=your@email.com
```

## Development Setup
- Node.js 18+ required
- Hot reload for development
- Build command generates static files