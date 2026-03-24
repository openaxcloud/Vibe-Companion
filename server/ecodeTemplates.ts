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

const KNOWN_DEPS: Record<string, string> = {
  "package.json": "Node.js (npm/yarn)",
  "requirements.txt": "Python (pip)",
  "Pipfile": "Python (pipenv)",
  "pyproject.toml": "Python (Poetry/PEP 517)",
  "go.mod": "Go modules",
  "Cargo.toml": "Rust (Cargo)",
  "Gemfile": "Ruby (Bundler)",
  "pom.xml": "Java (Maven)",
  "build.gradle": "Java/Kotlin (Gradle)",
  "composer.json": "PHP (Composer)",
  "pubspec.yaml": "Dart/Flutter (pub)",
  "Makefile": "Make",
  "CMakeLists.txt": "CMake",
  "docker-compose.yml": "Docker Compose",
  "Dockerfile": "Docker",
  ".env": "Environment variables",
};

const FRAMEWORK_PATTERNS: Record<string, string> = {
  "next.config": "Next.js",
  "nuxt.config": "Nuxt.js",
  "vite.config": "Vite",
  "webpack.config": "Webpack",
  "tailwind.config": "Tailwind CSS",
  "tsconfig.json": "TypeScript",
  ".eslintrc": "ESLint",
  ".prettierrc": "Prettier",
  "jest.config": "Jest",
  "vitest.config": "Vitest",
  "drizzle.config": "Drizzle ORM",
  "prisma/schema.prisma": "Prisma ORM",
  "angular.json": "Angular",
  "svelte.config": "SvelteKit",
  "remix.config": "Remix",
  "astro.config": "Astro",
  "expo/": "Expo (React Native)",
  "app.json": "React Native / Expo",
};

export function generateEcodeContent(projectName: string, language: string): string {
  const template = LANGUAGE_TEMPLATES[language] || LANGUAGE_TEMPLATES.javascript;
  const langDisplay = language.charAt(0).toUpperCase() + language.slice(1);

  return `# ${projectName} — Project Guidelines

## Overview
This is a ${langDisplay} project managed in E-Code IDE. This file (\`ecode.md\`) provides
project-specific context to the AI assistant and serves as living documentation.
It is automatically updated when the AI agent makes significant changes.

## Technology
- **Language**: ${langDisplay}
- **Entry point**: \`${template.entryFile}\`

## Coding Standards
${template.standards}

## Patterns & Conventions
${template.patterns}

## Project Structure
<!-- AUTO-GENERATED: The AI agent updates this section automatically after changes -->
- \`${template.entryFile}\` — Main entry point

## Dependencies & Frameworks
<!-- AUTO-GENERATED: Detected from project files -->
_No dependencies detected yet._

## Communication Preferences
- Provide complete, working code when making changes
- Explain significant design decisions
- Suggest improvements when appropriate
- Use the project's established patterns and naming conventions

## User Preferences
<!-- Add your preferences below — the AI will follow them in all interactions -->
<!-- Examples:
- Always use TypeScript strict mode
- Prefer Tailwind CSS for styling
- Use functional components with hooks
- Write tests for new features
- Use dark mode for UI designs
-->

## Project Context
Add any project-specific notes, API keys to reference, deployment targets,
or domain knowledge the AI should be aware of when assisting you.

---
_Last auto-updated: ${new Date().toISOString()}_
`;
}

export function buildProjectStructureTree(filenames: string[]): string {
  const sorted = filenames
    .filter(f => f !== "ecode.md")
    .sort((a, b) => {
      const aDepth = a.split("/").length;
      const bDepth = b.split("/").length;
      if (aDepth !== bDepth) return aDepth - bDepth;
      return a.localeCompare(b);
    });

  if (sorted.length === 0) return "- _(empty project)_";

  const dirs = new Map<string, string[]>();
  const rootFiles: string[] = [];

  for (const f of sorted) {
    const parts = f.split("/");
    if (parts.length === 1) {
      rootFiles.push(f);
    } else {
      const dir = parts[0];
      if (!dirs.has(dir)) dirs.set(dir, []);
      dirs.get(dir)!.push(f);
    }
  }

  const lines: string[] = [];

  for (const rf of rootFiles) {
    const desc = describeFile(rf);
    lines.push(`- \`${rf}\`${desc ? ` — ${desc}` : ""}`);
  }

  for (const [dir, files] of dirs) {
    lines.push(`- \`${dir}/\``);
    const maxShow = 8;
    const shown = files.slice(0, maxShow);
    for (const f of shown) {
      const shortName = f.split("/").slice(1).join("/");
      lines.push(`  - \`${shortName}\``);
    }
    if (files.length > maxShow) {
      lines.push(`  - _...and ${files.length - maxShow} more files_`);
    }
  }

  return lines.join("\n");
}

function describeFile(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower === "package.json") return "Node.js dependencies and scripts";
  if (lower === "tsconfig.json") return "TypeScript configuration";
  if (lower === "readme.md") return "Project documentation";
  if (lower === ".gitignore") return "Git ignore rules";
  if (lower === ".env") return "Environment variables";
  if (lower === "dockerfile") return "Docker container definition";
  if (lower.endsWith(".config.js") || lower.endsWith(".config.ts") || lower.endsWith(".config.mjs")) return "Build/tool configuration";
  if (lower === "requirements.txt") return "Python dependencies";
  if (lower === "cargo.toml") return "Rust dependencies";
  if (lower === "go.mod") return "Go module definition";
  if (lower === "gemfile") return "Ruby dependencies";
  if (lower === "makefile") return "Build automation";
  return "";
}

export function detectDependencies(filenames: string[]): string[] {
  const detected: string[] = [];
  for (const f of filenames) {
    const base = f.split("/").pop() || f;
    if (KNOWN_DEPS[base]) {
      detected.push(KNOWN_DEPS[base]);
    }
    for (const [pattern, framework] of Object.entries(FRAMEWORK_PATTERNS)) {
      if (f.includes(pattern) && !detected.includes(framework)) {
        detected.push(framework);
      }
    }
  }
  return [...new Set(detected)];
}

export function detectDependenciesFromPackageJson(content: string): string[] {
  try {
    const pkg = JSON.parse(content);
    const deps: string[] = [];
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name] of Object.entries(allDeps)) {
      deps.push(name);
    }
    return deps;
  } catch {
    return [];
  }
}

export function parseUserPreferences(ecodeContent: string): string[] {
  const lines = ecodeContent.split("\n");
  let inPreferences = false;
  let inComment = false;
  const prefs: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## User Preferences")) {
      inPreferences = true;
      continue;
    }
    if (inPreferences && (line.startsWith("## ") || line.startsWith("---"))) {
      break;
    }
    if (inPreferences) {
      const trimmed = line.trim();
      if (trimmed.startsWith("<!--")) {
        inComment = true;
        if (trimmed.includes("-->")) inComment = false;
        continue;
      }
      if (inComment) {
        if (trimmed.includes("-->")) inComment = false;
        continue;
      }
      if (trimmed && !trimmed.startsWith("_") && !trimmed.startsWith("-->")) {
        prefs.push(trimmed);
      }
    }
  }

  return prefs;
}

export function parseProjectContext(ecodeContent: string): string {
  const lines = ecodeContent.split("\n");
  let inContext = false;
  const contextLines: string[] = [];
  const defaultPhrases = [
    "Add any project-specific",
    "or domain knowledge the AI should",
  ];

  for (const line of lines) {
    if (line.startsWith("## Project Context")) {
      inContext = true;
      continue;
    }
    if (inContext && (line.startsWith("## ") || line.startsWith("---"))) {
      break;
    }
    if (inContext) {
      const trimmed = line.trim();
      if (trimmed && !defaultPhrases.some(p => trimmed.startsWith(p))) {
        contextLines.push(trimmed);
      }
    }
  }

  return contextLines.join("\n").trim();
}

export function updateEcodeStructureSection(
  existingContent: string,
  filenames: string[],
  packageJsonContent?: string
): string {
  const newStructure = buildProjectStructureTree(filenames);

  const deps = detectDependencies(filenames);
  let depsList: string;
  if (packageJsonContent) {
    const pkgDeps = detectDependenciesFromPackageJson(packageJsonContent);
    const allDeps = [...deps];
    if (pkgDeps.length > 0) {
      const majorDeps = pkgDeps.slice(0, 15);
      allDeps.push(...majorDeps.map(d => `\`${d}\``));
    }
    depsList = allDeps.length > 0 ? allDeps.map(d => `- ${d}`).join("\n") : "_No dependencies detected yet._";
  } else {
    depsList = deps.length > 0 ? deps.map(d => `- ${d}`).join("\n") : "_No dependencies detected yet._";
  }

  let content = existingContent;

  const structureRegex = /(## Project Structure\n(?:<!-- AUTO-GENERATED[^\n]*-->\n)?)([\s\S]*?)((?=\n## )|(?=\n---)|$)/;
  const structureMatch = content.match(structureRegex);
  if (structureMatch) {
    content = content.replace(structureRegex, `## Project Structure\n<!-- AUTO-GENERATED: The AI agent updates this section automatically after changes -->\n${newStructure}\n`);
  }

  const depsRegex = /(## Dependencies & Frameworks\n(?:<!-- AUTO-GENERATED[^\n]*-->\n)?)([\s\S]*?)((?=\n## )|(?=\n---)|$)/;
  const depsMatch = content.match(depsRegex);
  if (depsMatch) {
    content = content.replace(depsRegex, `## Dependencies & Frameworks\n<!-- AUTO-GENERATED: Detected from project files -->\n${depsList}\n`);
  } else {
    const insertPoint = content.indexOf("## Communication Preferences");
    if (insertPoint > -1) {
      content = content.slice(0, insertPoint) +
        `## Dependencies & Frameworks\n<!-- AUTO-GENERATED: Detected from project files -->\n${depsList}\n\n` +
        content.slice(insertPoint);
    }
  }

  const timestampRegex = /_Last auto-updated:.*_/;
  if (timestampRegex.test(content)) {
    content = content.replace(timestampRegex, `_Last auto-updated: ${new Date().toISOString()}_`);
  } else {
    if (!content.endsWith("\n")) content += "\n";
    content += `\n---\n_Last auto-updated: ${new Date().toISOString()}_\n`;
  }

  return content;
}

export function buildEcodePromptContext(ecodeContent: string): string {
  const prefs = parseUserPreferences(ecodeContent);
  const context = parseProjectContext(ecodeContent);

  let prompt = `\n\n## Project Guidelines (ecode.md)\n${ecodeContent}`;

  if (prefs.length > 0) {
    prompt += `\n\n## IMPORTANT: User Preferences (from ecode.md)\nThe user has specified these preferences. Follow them strictly in all responses:\n${prefs.join("\n")}`;
  }

  if (context) {
    prompt += `\n\n## Project Context (from ecode.md)\n${context}`;
  }

  return prompt;
}

export function shouldAutoUpdate(
  previousFilenames: string[],
  currentFilenames: string[],
  modifiedFiles: Set<string>
): boolean {
  if (modifiedFiles.size === 0) return false;

  const newFiles = currentFilenames.filter(f => !previousFilenames.includes(f));
  const deletedFiles = previousFilenames.filter(f => !currentFilenames.includes(f));

  if (newFiles.length >= 1 || deletedFiles.length >= 1) return true;

  const significantFiles = [
    "package.json", "requirements.txt", "go.mod", "Cargo.toml",
    "tsconfig.json", "Dockerfile", "docker-compose.yml",
    ".env", "Makefile", "CMakeLists.txt",
  ];
  for (const sf of significantFiles) {
    if (modifiedFiles.has(sf)) return true;
  }

  for (const f of modifiedFiles) {
    if (f.endsWith(".config.js") || f.endsWith(".config.ts") || f.endsWith(".config.mjs")) return true;
  }

  if (modifiedFiles.size >= 3) return true;

  return false;
}

export function getEcodeFilename(): string {
  return "ecode.md";
}
