import type { LanguageSupport } from '@codemirror/language';

type LanguageLoader = () => Promise<LanguageSupport>;

const languageCache = new Map<string, LanguageSupport>();

const languageLoaders: Record<string, LanguageLoader> = {
  javascript: async () => {
    const { javascript } = await import('@codemirror/lang-javascript');
    return javascript();
  },
  jsx: async () => {
    const { javascript } = await import('@codemirror/lang-javascript');
    return javascript({ jsx: true });
  },
  typescript: async () => {
    const { javascript } = await import('@codemirror/lang-javascript');
    return javascript({ typescript: true });
  },
  tsx: async () => {
    const { javascript } = await import('@codemirror/lang-javascript');
    return javascript({ jsx: true, typescript: true });
  },
  python: async () => {
    const { python } = await import('@codemirror/lang-python');
    return python();
  },
  json: async () => {
    const { json } = await import('@codemirror/lang-json');
    return json();
  },
  html: async () => {
    const { html } = await import('@codemirror/lang-html');
    return html();
  },
  css: async () => {
    const { css } = await import('@codemirror/lang-css');
    return css();
  },
  scss: async () => {
    const { css } = await import('@codemirror/lang-css');
    return css();
  },
  sass: async () => {
    const { css } = await import('@codemirror/lang-css');
    return css();
  },
  less: async () => {
    const { css } = await import('@codemirror/lang-css');
    return css();
  },
  markdown: async () => {
    const { markdown } = await import('@codemirror/lang-markdown');
    return markdown();
  },
  sql: async () => {
    const { sql } = await import('@codemirror/lang-sql');
    return sql();
  },
  rust: async () => {
    const { rust } = await import('@codemirror/lang-rust');
    return rust();
  },
  java: async () => {
    const { java } = await import('@codemirror/lang-java');
    return java();
  },
  cpp: async () => {
    const { cpp } = await import('@codemirror/lang-cpp');
    return cpp();
  },
  c: async () => {
    const { cpp } = await import('@codemirror/lang-cpp');
    return cpp();
  },
  php: async () => {
    const { php } = await import('@codemirror/lang-php');
    return php();
  },
  xml: async () => {
    const { xml } = await import('@codemirror/lang-xml');
    return xml();
  },
  yaml: async () => {
    const { yaml } = await import('@codemirror/lang-yaml');
    return yaml();
  },
  yml: async () => {
    const { yaml } = await import('@codemirror/lang-yaml');
    return yaml();
  },
  shell: async () => {
    const { StreamLanguage } = await import('@codemirror/language');
    const { shell } = await import('@codemirror/legacy-modes/mode/shell');
    return new (await import('@codemirror/language')).LanguageSupport(
      StreamLanguage.define(shell)
    );
  },
  bash: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { shell } = await import('@codemirror/legacy-modes/mode/shell');
    return new LanguageSupport(StreamLanguage.define(shell));
  },
  sh: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { shell } = await import('@codemirror/legacy-modes/mode/shell');
    return new LanguageSupport(StreamLanguage.define(shell));
  },
  go: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { go } = await import('@codemirror/legacy-modes/mode/go');
    return new LanguageSupport(StreamLanguage.define(go));
  },
  ruby: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { ruby } = await import('@codemirror/legacy-modes/mode/ruby');
    return new LanguageSupport(StreamLanguage.define(ruby));
  },
  csharp: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { csharp } = await import('@codemirror/legacy-modes/mode/clike');
    return new LanguageSupport(StreamLanguage.define(csharp));
  },
  swift: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { swift } = await import('@codemirror/legacy-modes/mode/swift');
    return new LanguageSupport(StreamLanguage.define(swift));
  },
  kotlin: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { kotlin } = await import('@codemirror/legacy-modes/mode/clike');
    return new LanguageSupport(StreamLanguage.define(kotlin));
  },
  dart: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { dart } = await import('@codemirror/legacy-modes/mode/clike');
    return new LanguageSupport(StreamLanguage.define(dart));
  },
  lua: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { lua } = await import('@codemirror/legacy-modes/mode/lua');
    return new LanguageSupport(StreamLanguage.define(lua));
  },
  perl: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { perl } = await import('@codemirror/legacy-modes/mode/perl');
    return new LanguageSupport(StreamLanguage.define(perl));
  },
  r: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { r } = await import('@codemirror/legacy-modes/mode/r');
    return new LanguageSupport(StreamLanguage.define(r));
  },
  haskell: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { haskell } = await import('@codemirror/legacy-modes/mode/haskell');
    return new LanguageSupport(StreamLanguage.define(haskell));
  },
  scala: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { scala } = await import('@codemirror/legacy-modes/mode/clike');
    return new LanguageSupport(StreamLanguage.define(scala));
  },
  clojure: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { clojure } = await import('@codemirror/legacy-modes/mode/clojure');
    return new LanguageSupport(StreamLanguage.define(clojure));
  },
  elixir: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { ruby } = await import('@codemirror/legacy-modes/mode/ruby');
    return new LanguageSupport(StreamLanguage.define(ruby));
  },
  julia: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { julia } = await import('@codemirror/legacy-modes/mode/julia');
    return new LanguageSupport(StreamLanguage.define(julia));
  },
  ocaml: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { oCaml } = await import('@codemirror/legacy-modes/mode/mllike');
    return new LanguageSupport(StreamLanguage.define(oCaml));
  },
  fortran: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { fortran } = await import('@codemirror/legacy-modes/mode/fortran');
    return new LanguageSupport(StreamLanguage.define(fortran));
  },
  nix: async () => {
    const { StreamLanguage, LanguageSupport } = await import('@codemirror/language');
    const { shell } = await import('@codemirror/legacy-modes/mode/shell');
    return new LanguageSupport(StreamLanguage.define(shell));
  },
  zig: async () => {
    const { cpp } = await import('@codemirror/lang-cpp');
    return cpp();
  },
};

const extensionToLanguage: Record<string, string> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.tsx': 'tsx',
  '.py': 'python',
  '.pyw': 'python',
  '.pyi': 'python',
  '.json': 'json',
  '.jsonc': 'json',
  '.json5': 'json',
  '.html': 'html',
  '.htm': 'html',
  '.xhtml': 'html',
  '.vue': 'html',
  '.svelte': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.mdx': 'markdown',
  '.sql': 'sql',
  '.rs': 'rust',
  '.java': 'java',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hxx': 'cpp',
  '.h': 'c',
  '.c': 'c',
  '.php': 'php',
  '.phtml': 'php',
  '.php3': 'php',
  '.php4': 'php',
  '.php5': 'php',
  '.php7': 'php',
  '.phps': 'php',
  '.xml': 'xml',
  '.xsl': 'xml',
  '.xslt': 'xml',
  '.svg': 'xml',
  '.wsdl': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.sh': 'shell',
  '.bash': 'bash',
  '.zsh': 'shell',
  '.fish': 'shell',
  '.ksh': 'shell',
  '.bashrc': 'bash',
  '.zshrc': 'shell',
  '.profile': 'shell',
  '.go': 'go',
  '.rb': 'ruby',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.dart': 'dart',
  '.lua': 'lua',
  '.pl': 'perl',
  '.pm': 'perl',
  '.r': 'r',
  '.R': 'r',
  '.hs': 'haskell',
  '.lhs': 'haskell',
  '.scala': 'scala',
  '.sc': 'scala',
  '.clj': 'clojure',
  '.cljs': 'clojure',
  '.cljc': 'clojure',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.jl': 'julia',
  '.ml': 'ocaml',
  '.mli': 'ocaml',
  '.f': 'fortran',
  '.for': 'fortran',
  '.f90': 'fortran',
  '.f95': 'fortran',
  '.nix': 'nix',
  '.zig': 'zig',
};

const filenameToLanguage: Record<string, string> = {
  Dockerfile: 'shell',
  Makefile: 'shell',
  '.bashrc': 'bash',
  '.bash_profile': 'bash',
  '.zshrc': 'shell',
  '.profile': 'shell',
  '.gitignore': 'shell',
  '.env': 'shell',
  '.env.local': 'shell',
  '.env.development': 'shell',
  '.env.production': 'shell',
  'package.json': 'json',
  'tsconfig.json': 'json',
  'jsconfig.json': 'json',
};

export async function loadLanguage(language: string): Promise<LanguageSupport | null> {
  const normalizedLanguage = language.toLowerCase().trim();

  if (languageCache.has(normalizedLanguage)) {
    return languageCache.get(normalizedLanguage)!;
  }

  const loader = languageLoaders[normalizedLanguage];
  if (!loader) {
    console.warn(`Language "${language}" is not supported`);
    return null;
  }

  try {
    const languageSupport = await loader();
    languageCache.set(normalizedLanguage, languageSupport);
    return languageSupport;
  } catch (error) {
    console.error(`Failed to load language "${language}":`, error);
    return null;
  }
}

export function getLanguageFromFilename(filename: string): string | null {
  const basename = filename.split('/').pop() || filename;

  if (filenameToLanguage[basename]) {
    return filenameToLanguage[basename];
  }

  const lastDotIndex = basename.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return null;
  }

  const extension = basename.slice(lastDotIndex).toLowerCase();
  return extensionToLanguage[extension] || null;
}

export async function loadLanguageForFile(filename: string): Promise<LanguageSupport | null> {
  const language = getLanguageFromFilename(filename);
  if (!language) {
    return null;
  }
  return loadLanguage(language);
}

export function getSupportedLanguages(): string[] {
  return Object.keys(languageLoaders);
}

export function getSupportedExtensions(): string[] {
  return Object.keys(extensionToLanguage);
}

export function isLanguageSupported(language: string): boolean {
  return language.toLowerCase() in languageLoaders;
}

export function isExtensionSupported(extension: string): boolean {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return ext.toLowerCase() in extensionToLanguage;
}

export function clearLanguageCache(): void {
  languageCache.clear();
}

export function preloadLanguages(languages: string[]): Promise<(LanguageSupport | null)[]> {
  return Promise.all(languages.map((lang) => loadLanguage(lang)));
}

export function preloadCommonLanguages(): Promise<(LanguageSupport | null)[]> {
  const commonLanguages = ['javascript', 'typescript', 'html', 'css', 'json', 'markdown'];
  return preloadLanguages(commonLanguages);
}
