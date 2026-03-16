const LANGUAGE_TEMPLATES: Record<string, { standards: string; patterns: string; entryFile: string }> = {
  javascript: {
    entryFile: "index.js",
    standards: `- Use ES6+ syntax (const/let, arrow functions, template literals, destructuring)
- Use camelCase for variables and functions, PascalCase for classes
- Prefer async/await over raw Promises
- Use strict equality (===) over loose equality (==)
- Add JSDoc comments for public functions`,
    patterns: `- Use module pattern with ES modules (import/export)
- Handle errors with try/catch blocks
- Use descriptive variable names
- Keep functions small and focused`,
  },
  typescript: {
    entryFile: "index.ts",
    standards: `- Define explicit types for function parameters and return values
- Use interfaces for object shapes, type aliases for unions/intersections
- Prefer const assertions for literal types
- Use strict TypeScript configuration
- Avoid \`any\` — use \`unknown\` when the type is truly unknown`,
    patterns: `- Use generics for reusable type-safe utilities
- Define shared types in a dedicated types file
- Use discriminated unions for state management
- Leverage TypeScript's type narrowing with guards`,
  },
  python: {
    entryFile: "main.py",
    standards: `- Follow PEP 8 style guide
- Use type hints for function signatures
- Use snake_case for variables and functions, PascalCase for classes
- Use f-strings for string formatting
- Add docstrings for public functions and classes`,
    patterns: `- Use virtual environments for dependency management
- Use list/dict comprehensions where readable
- Handle exceptions with specific exception types
- Use pathlib for file system operations`,
  },
  go: {
    entryFile: "main.go",
    standards: `- Follow Effective Go guidelines
- Use gofmt for formatting
- Use short variable names for small scopes, descriptive names for larger scopes
- Always handle errors — never use blank identifier for error values
- Use CamelCase for exported, camelCase for unexported`,
    patterns: `- Use interfaces for abstraction
- Prefer composition over inheritance
- Use goroutines and channels for concurrency
- Keep packages focused and cohesive
- Use defer for cleanup operations`,
  },
  ruby: {
    entryFile: "main.rb",
    standards: `- Follow Ruby style guide conventions
- Use snake_case for methods and variables, PascalCase for classes
- Use 2-space indentation
- Prefer string interpolation over concatenation
- Use symbols instead of strings for hash keys`,
    patterns: `- Use blocks and iterators over loops
- Follow convention over configuration
- Use modules for mixins and namespacing
- Keep methods short (under 10 lines ideally)`,
  },
  cpp: {
    entryFile: "main.cpp",
    standards: `- Follow C++ Core Guidelines
- Use modern C++ features (C++17/20)
- Use smart pointers instead of raw pointers
- Use const correctness throughout
- Use snake_case for variables/functions, PascalCase for types`,
    patterns: `- Use RAII for resource management
- Prefer references over pointers where possible
- Use templates for generic programming
- Use namespaces to avoid name collisions
- Minimize header dependencies`,
  },
  c: {
    entryFile: "main.c",
    standards: `- Follow C99/C11 standard
- Use snake_case for variables and functions
- Use UPPER_CASE for macros and constants
- Always check return values of system calls
- Free allocated memory to prevent leaks`,
    patterns: `- Use header guards in all header files
- Keep functions focused and under 50 lines
- Use structs for related data grouping
- Use const for read-only parameters
- Document function contracts with comments`,
  },
  java: {
    entryFile: "Main.java",
    standards: `- Follow Java naming conventions (camelCase methods, PascalCase classes)
- Use access modifiers appropriately (private by default)
- Use generics for type-safe collections
- Handle checked exceptions properly
- Use @Override annotation for overridden methods`,
    patterns: `- Follow SOLID principles
- Use interfaces for abstraction
- Prefer composition over inheritance
- Use try-with-resources for AutoCloseable objects
- Use Optional instead of null returns`,
  },
  rust: {
    entryFile: "main.rs",
    standards: `- Follow Rust naming conventions (snake_case functions, PascalCase types)
- Use clippy for linting
- Handle all Result and Option types — avoid unwrap() in production
- Use lifetimes explicitly when needed
- Document public APIs with /// doc comments`,
    patterns: `- Use ownership and borrowing correctly
- Prefer iterators over manual loops
- Use enums with data for state machines
- Use traits for polymorphism
- Use match for exhaustive pattern handling`,
  },
  bash: {
    entryFile: "main.sh",
    standards: `- Start scripts with #!/bin/bash
- Use set -euo pipefail for safety
- Quote all variable expansions
- Use lowercase for local variables, UPPERCASE for exports
- Add comments explaining non-obvious logic`,
    patterns: `- Use functions for reusable logic
- Validate inputs at the start of scripts
- Use trap for cleanup on exit
- Prefer [[ ]] over [ ] for conditionals
- Use shellcheck for linting`,
  },
  html: {
    entryFile: "index.html",
    standards: `- Use semantic HTML5 elements (header, nav, main, footer, article, section)
- Include proper meta tags and viewport settings
- Use lowercase for element and attribute names
- Always include alt attributes on images
- Keep markup clean and well-indented`,
    patterns: `- Separate structure (HTML), presentation (CSS), and behavior (JS)
- Use CSS classes over inline styles
- Follow BEM or similar naming convention for CSS classes
- Ensure accessibility (ARIA labels, keyboard navigation)
- Use responsive design principles`,
  },
};

export function generateEcodeContent(projectName: string, language: string): string {
  const template = LANGUAGE_TEMPLATES[language] || LANGUAGE_TEMPLATES.javascript;
  const langDisplay = language.charAt(0).toUpperCase() + language.slice(1);

  return `# ${projectName} — Project Guidelines

## Overview
This is a ${langDisplay} project managed in E-Code IDE. This file (\`ecode.md\`) provides
project-specific context to the AI assistant and serves as living documentation.

## Technology
- **Language**: ${langDisplay}
- **Entry point**: \`${template.entryFile}\`

## Coding Standards
${template.standards}

## Patterns & Conventions
${template.patterns}

## Project Structure
Describe the project layout as it grows:
- \`${template.entryFile}\` — Main entry point

## Communication Preferences
- Provide complete, working code when making changes
- Explain significant design decisions
- Suggest improvements when appropriate
- Use the project's established patterns and naming conventions

## Project Context
Add any project-specific notes, API keys to reference, deployment targets,
or domain knowledge the AI should be aware of when assisting you.
`;
}

export function getEcodeFilename(): string {
  return "ecode.md";
}
