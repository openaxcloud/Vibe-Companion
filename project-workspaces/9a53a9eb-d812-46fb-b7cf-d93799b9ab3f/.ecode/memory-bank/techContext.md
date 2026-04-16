# Technical Context

## Tech Stack
- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and building
- **Styling**: Tailwind CSS for utility-first styling
- **Markdown**: remark + rehype ecosystem for processing
- **Syntax Highlighting**: Prism.js with custom themes
- **RSS Generation**: feed library for RSS 2.0 compliance

## Key Dependencies
```json
{
  "react": "^18.0.0",
  "typescript": "^5.0.0",
  "vite": "^4.0.0",
  "tailwindcss": "^3.0.0",
  "remark": "^14.0.0",
  "rehype-prism-plus": "^1.0.0",
  "gray-matter": "^4.0.0",
  "feed": "^4.0.0"
}
```

## Environment Variables
- `VITE_SITE_URL`: Production site URL for RSS feed
- `VITE_AUTHOR_NAME`: Blog author name
- `VITE_AUTHOR_EMAIL`: Contact email for RSS feed