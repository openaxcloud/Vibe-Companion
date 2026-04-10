import * as path from 'path';
import { createLogger } from '../../utils/logger';

const logger = createLogger('rag-chunker');

export interface CodeChunk {
  content: string;
  chunkIndex: number;
  chunkType: 'function' | 'class' | 'method' | 'interface' | 'type' | 'import' | 'export' | 'block' | 'comment' | 'config' | 'style' | 'markup' | 'test' | 'module';
  language: string;
  startLine: number;
  endLine: number;
  symbolName?: string;
  symbolType?: string;
  imports: string[];
  exports: string[];
}

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java', '.kt': 'kotlin',
  '.swift': 'swift', '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
  '.cs': 'csharp', '.rb': 'ruby', '.php': 'php', '.scala': 'scala',
  '.css': 'css', '.scss': 'scss', '.less': 'less', '.sass': 'sass',
  '.html': 'html', '.htm': 'html', '.vue': 'vue', '.svelte': 'svelte',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  '.xml': 'xml', '.graphql': 'graphql', '.gql': 'graphql',
  '.md': 'markdown', '.mdx': 'markdown', '.txt': 'text', '.rst': 'rst',
  '.sql': 'sql', '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  '.dockerfile': 'dockerfile', '.proto': 'protobuf', '.prisma': 'prisma',
  '.env': 'env', '.gitignore': 'gitignore', '.r': 'r', '.R': 'r',
  '.lua': 'lua', '.dart': 'dart', '.ex': 'elixir', '.exs': 'elixir',
  '.erl': 'erlang', '.hs': 'haskell', '.ml': 'ocaml', '.clj': 'clojure',
  '.zig': 'zig', '.nim': 'nim', '.v': 'vlang',
};

const MAX_CHUNK_SIZE = 2000;
const MIN_CHUNK_SIZE = 50;
const OVERLAP_LINES = 2;

export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();
  if (basename === 'dockerfile') return 'dockerfile';
  if (basename === 'makefile') return 'makefile';
  if (basename === '.env' || basename.startsWith('.env.')) return 'env';
  if (basename === '.gitignore' || basename === '.dockerignore') return 'gitignore';
  return LANGUAGE_MAP[ext] || 'text';
}

export function chunkFile(content: string, filePath: string): CodeChunk[] {
  const language = detectLanguage(filePath);
  const lines = content.split('\n');

  if (content.length < MIN_CHUNK_SIZE) return [];
  if (content.length <= MAX_CHUNK_SIZE) {
    return [{
      content,
      chunkIndex: 0,
      chunkType: 'module',
      language,
      startLine: 1,
      endLine: lines.length,
      imports: extractImports(content, language),
      exports: extractExports(content, language),
    }];
  }

  switch (language) {
    case 'typescript': case 'javascript':
      return chunkTSJS(content, lines, language);
    case 'python':
      return chunkPython(content, lines, language);
    case 'go':
      return chunkGo(content, lines, language);
    case 'rust':
      return chunkRust(content, lines, language);
    case 'java': case 'kotlin': case 'csharp': case 'scala':
      return chunkCStyle(content, lines, language);
    case 'ruby':
      return chunkRuby(content, lines, language);
    case 'css': case 'scss': case 'less': case 'sass':
      return chunkCSS(content, lines, language);
    case 'html': case 'vue': case 'svelte':
      return chunkMarkup(content, lines, language);
    case 'json': case 'yaml': case 'toml':
      return chunkConfig(content, lines, language);
    case 'markdown': case 'rst':
      return chunkMarkdown(content, lines, language);
    case 'sql':
      return chunkSQL(content, lines, language);
    default:
      return chunkGeneric(content, lines, language);
  }
}

function chunkTSJS(content: string, lines: string[], language: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  let chunkIndex = 0;

  const patterns = [
    { regex: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/m, type: 'function' as const },
    { regex: /^(?:export\s+)?(?:default\s+)?class\s+(\w+)/m, type: 'class' as const },
    { regex: /^(?:export\s+)?interface\s+(\w+)/m, type: 'interface' as const },
    { regex: /^(?:export\s+)?type\s+(\w+)/m, type: 'type' as const },
    { regex: /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/m, type: 'function' as const },
    { regex: /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*\{/m, type: 'export' as const },
    { regex: /^(?:export\s+)?enum\s+(\w+)/m, type: 'type' as const },
  ];

  const symbols = findSymbolBoundaries(lines, patterns, '{', '}');
  const importBlock = extractImportBlock(lines, language);

  if (importBlock) {
    chunks.push({
      content: importBlock.content,
      chunkIndex: chunkIndex++,
      chunkType: 'import',
      language,
      startLine: importBlock.startLine,
      endLine: importBlock.endLine,
      imports: extractImports(importBlock.content, language),
      exports: [],
    });
  }

  for (const sym of symbols) {
    const chunkContent = lines.slice(sym.startLine - 1, sym.endLine).join('\n');
    if (chunkContent.length > MAX_CHUNK_SIZE) {
      const subChunks = splitLargeChunk(chunkContent, sym.startLine, language, sym.type, sym.name);
      for (const sub of subChunks) {
        sub.chunkIndex = chunkIndex++;
        chunks.push(sub);
      }
    } else if (chunkContent.length >= MIN_CHUNK_SIZE) {
      chunks.push({
        content: chunkContent,
        chunkIndex: chunkIndex++,
        chunkType: sym.type,
        language,
        startLine: sym.startLine,
        endLine: sym.endLine,
        symbolName: sym.name,
        symbolType: sym.type,
        imports: [],
        exports: sym.exported ? [sym.name] : [],
      });
    }
  }

  const covered = new Set<number>();
  for (const c of chunks) {
    for (let i = c.startLine; i <= c.endLine; i++) covered.add(i);
  }
  const uncovered = findUncoveredRanges(lines.length, covered);
  for (const range of uncovered) {
    const blockContent = lines.slice(range.start - 1, range.end).join('\n').trim();
    if (blockContent.length >= MIN_CHUNK_SIZE) {
      chunks.push({
        content: blockContent,
        chunkIndex: chunkIndex++,
        chunkType: 'block',
        language,
        startLine: range.start,
        endLine: range.end,
        imports: [],
        exports: [],
      });
    }
  }

  return chunks;
}

function chunkPython(content: string, lines: string[], language: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  let chunkIndex = 0;

  const importLines: string[] = [];
  let importEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import ') || line.startsWith('from ')) {
      importLines.push(lines[i]);
      importEnd = i + 1;
    } else if (line === '' || line.startsWith('#')) {
      if (importLines.length > 0) importLines.push(lines[i]);
    } else if (importLines.length > 0) {
      break;
    }
  }
  if (importLines.length > 0) {
    chunks.push({
      content: importLines.join('\n'),
      chunkIndex: chunkIndex++,
      chunkType: 'import',
      language,
      startLine: 1,
      endLine: importEnd,
      imports: importLines.filter(l => l.trim().startsWith('import') || l.trim().startsWith('from')).map(l => l.trim()),
      exports: [],
    });
  }

  const symbolRegex = /^((?:async\s+)?def|class)\s+(\w+)/;
  let i = importEnd;
  while (i < lines.length) {
    const match = lines[i].match(symbolRegex);
    if (match) {
      const type = match[1].includes('class') ? 'class' as const : 'function' as const;
      const name = match[2];
      const indent = lines[i].search(/\S/);
      const startLine = i + 1;
      let endLine = i + 1;

      for (let j = i + 1; j < lines.length; j++) {
        const lineContent = lines[j];
        if (lineContent.trim() === '') { endLine = j + 1; continue; }
        const lineIndent = lineContent.search(/\S/);
        if (lineIndent <= indent && lineContent.trim() !== '') break;
        endLine = j + 1;
      }

      const chunkContent = lines.slice(i, endLine).join('\n');
      if (chunkContent.length > MAX_CHUNK_SIZE) {
        const subChunks = splitLargeChunk(chunkContent, startLine, language, type, name);
        for (const sub of subChunks) { sub.chunkIndex = chunkIndex++; chunks.push(sub); }
      } else if (chunkContent.length >= MIN_CHUNK_SIZE) {
        chunks.push({ content: chunkContent, chunkIndex: chunkIndex++, chunkType: type, language, startLine, endLine, symbolName: name, symbolType: type, imports: [], exports: [] });
      }
      i = endLine;
    } else {
      i++;
    }
  }

  return addUncoveredChunks(chunks, lines, language, chunkIndex);
}

function chunkGo(content: string, lines: string[], language: string): CodeChunk[] {
  const patterns = [
    { regex: /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/m, type: 'function' as const },
    { regex: /^type\s+(\w+)\s+struct/m, type: 'class' as const },
    { regex: /^type\s+(\w+)\s+interface/m, type: 'interface' as const },
  ];
  return chunkWithBraces(content, lines, language, patterns);
}

function chunkRust(content: string, lines: string[], language: string): CodeChunk[] {
  const patterns = [
    { regex: /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/m, type: 'function' as const },
    { regex: /^(?:pub\s+)?struct\s+(\w+)/m, type: 'class' as const },
    { regex: /^(?:pub\s+)?trait\s+(\w+)/m, type: 'interface' as const },
    { regex: /^(?:pub\s+)?enum\s+(\w+)/m, type: 'type' as const },
    { regex: /^impl(?:<[^>]+>)?\s+(\w+)/m, type: 'class' as const },
    { regex: /^(?:pub\s+)?mod\s+(\w+)/m, type: 'module' as const },
  ];
  return chunkWithBraces(content, lines, language, patterns);
}

function chunkCStyle(content: string, lines: string[], language: string): CodeChunk[] {
  const patterns = [
    { regex: /^(?:public|private|protected|static|abstract|final|override|virtual|async)?\s*(?:public|private|protected|static|abstract|final|override|virtual|async)?\s*(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/m, type: 'function' as const },
    { regex: /^(?:public|private|protected|static|abstract|final)?\s*class\s+(\w+)/m, type: 'class' as const },
    { regex: /^(?:public|private|protected)?\s*interface\s+(\w+)/m, type: 'interface' as const },
    { regex: /^(?:public|private|protected)?\s*enum\s+(\w+)/m, type: 'type' as const },
  ];
  return chunkWithBraces(content, lines, language, patterns);
}

function chunkRuby(content: string, lines: string[], language: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  let chunkIndex = 0;
  const symbolRegex = /^(?:\s*)(def|class|module)\s+(\S+)/;
  let i = 0;

  while (i < lines.length) {
    const match = lines[i].match(symbolRegex);
    if (match) {
      const type = match[1] === 'class' ? 'class' as const : match[1] === 'module' ? 'module' as const : 'function' as const;
      const name = match[2];
      const startLine = i + 1;
      let depth = 1;
      let j = i + 1;
      while (j < lines.length && depth > 0) {
        const line = lines[j].trim();
        if (/^(def|class|module|if|unless|while|until|for|case|begin|do)\b/.test(line)) depth++;
        if (/^end\b/.test(line)) depth--;
        j++;
      }
      const endLine = j;
      const chunkContent = lines.slice(i, endLine).join('\n');
      if (chunkContent.length >= MIN_CHUNK_SIZE) {
        chunks.push({ content: chunkContent.slice(0, MAX_CHUNK_SIZE), chunkIndex: chunkIndex++, chunkType: type, language, startLine, endLine, symbolName: name, symbolType: type, imports: [], exports: [] });
      }
      i = endLine;
    } else {
      i++;
    }
  }
  return addUncoveredChunks(chunks, lines, language, chunkIndex);
}

function chunkCSS(content: string, lines: string[], language: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  let chunkIndex = 0;
  const ruleRegex = /^([.#@][\w-]+[^{]*)\{/;

  let i = 0;
  while (i < lines.length) {
    const match = lines[i].match(ruleRegex);
    if (match) {
      const name = match[1].trim();
      const startLine = i + 1;
      let depth = 0;
      let j = i;
      while (j < lines.length) {
        depth += (lines[j].match(/\{/g) || []).length;
        depth -= (lines[j].match(/\}/g) || []).length;
        j++;
        if (depth <= 0) break;
      }
      const chunkContent = lines.slice(i, j).join('\n');
      if (chunkContent.length >= MIN_CHUNK_SIZE) {
        chunks.push({ content: chunkContent.slice(0, MAX_CHUNK_SIZE), chunkIndex: chunkIndex++, chunkType: 'style', language, startLine, endLine: j, symbolName: name, symbolType: 'rule', imports: [], exports: [] });
      }
      i = j;
    } else {
      i++;
    }
  }
  return chunks.length > 0 ? chunks : chunkGeneric(content, lines, language);
}

function chunkMarkup(content: string, lines: string[], language: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  let chunkIndex = 0;

  if (language === 'vue' || language === 'svelte') {
    const sectionRegex = /<(template|script|style)([^>]*)>/gi;
    let match;
    while ((match = sectionRegex.exec(content)) !== null) {
      const tag = match[1].toLowerCase();
      const startIdx = match.index;
      const endTag = `</${tag}>`;
      const endIdx = content.indexOf(endTag, startIdx);
      if (endIdx === -1) continue;
      const sectionContent = content.slice(startIdx, endIdx + endTag.length);
      const startLine = content.slice(0, startIdx).split('\n').length;
      const endLine = content.slice(0, endIdx + endTag.length).split('\n').length;
      if (sectionContent.length >= MIN_CHUNK_SIZE) {
        const type = tag === 'script' ? 'block' as const : tag === 'style' ? 'style' as const : 'markup' as const;
        chunks.push({ content: sectionContent.slice(0, MAX_CHUNK_SIZE), chunkIndex: chunkIndex++, chunkType: type, language, startLine, endLine, symbolName: tag, symbolType: 'section', imports: extractImports(sectionContent, language), exports: [] });
      }
    }
    return chunks.length > 0 ? chunks : chunkGeneric(content, lines, language);
  }

  return chunkGeneric(content, lines, language);
}

function chunkConfig(content: string, lines: string[], language: string): CodeChunk[] {
  if (content.length <= MAX_CHUNK_SIZE) {
    return [{ content, chunkIndex: 0, chunkType: 'config', language, startLine: 1, endLine: lines.length, imports: [], exports: [] }];
  }

  if (language === 'json') {
    try {
      const parsed = JSON.parse(content);
      const chunks: CodeChunk[] = [];
      let chunkIndex = 0;
      const topKeys = Object.keys(parsed);
      for (const key of topKeys) {
        const val = JSON.stringify({ [key]: parsed[key] }, null, 2);
        if (val.length >= MIN_CHUNK_SIZE) {
          chunks.push({ content: val.slice(0, MAX_CHUNK_SIZE), chunkIndex: chunkIndex++, chunkType: 'config', language, startLine: 1, endLine: 1, symbolName: key, symbolType: 'key', imports: [], exports: [] });
        }
      }
      return chunks;
    } catch { /* fall through */ }
  }

  return chunkGeneric(content, lines, language);
}

function chunkMarkdown(content: string, lines: string[], language: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  let chunkIndex = 0;
  const headingRegex = /^(#{1,6})\s+(.+)/;
  let currentStart = 0;
  let currentHeading = '';

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(headingRegex);
    if (match && i > 0) {
      const blockContent = lines.slice(currentStart, i).join('\n').trim();
      if (blockContent.length >= MIN_CHUNK_SIZE) {
        chunks.push({ content: blockContent.slice(0, MAX_CHUNK_SIZE), chunkIndex: chunkIndex++, chunkType: 'block', language, startLine: currentStart + 1, endLine: i, symbolName: currentHeading || undefined, symbolType: 'section', imports: [], exports: [] });
      }
      currentStart = i;
      currentHeading = match[2];
    }
  }
  const lastBlock = lines.slice(currentStart).join('\n').trim();
  if (lastBlock.length >= MIN_CHUNK_SIZE) {
    chunks.push({ content: lastBlock.slice(0, MAX_CHUNK_SIZE), chunkIndex: chunkIndex++, chunkType: 'block', language, startLine: currentStart + 1, endLine: lines.length, symbolName: currentHeading || undefined, symbolType: 'section', imports: [], exports: [] });
  }
  return chunks;
}

function chunkSQL(content: string, lines: string[], language: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  let chunkIndex = 0;
  const statementRegex = /;/g;
  let lastEnd = 0;

  let match;
  while ((match = statementRegex.exec(content)) !== null) {
    const stmt = content.slice(lastEnd, match.index + 1).trim();
    if (stmt.length >= MIN_CHUNK_SIZE) {
      const startLine = content.slice(0, lastEnd).split('\n').length;
      const endLine = content.slice(0, match.index + 1).split('\n').length;
      const nameMatch = stmt.match(/(?:CREATE|ALTER|DROP)\s+(?:TABLE|VIEW|FUNCTION|PROCEDURE|INDEX|TYPE)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?(\S+)/i);
      chunks.push({ content: stmt.slice(0, MAX_CHUNK_SIZE), chunkIndex: chunkIndex++, chunkType: 'block', language, startLine, endLine, symbolName: nameMatch?.[1], symbolType: 'statement', imports: [], exports: [] });
    }
    lastEnd = match.index + 1;
  }
  return chunks.length > 0 ? chunks : chunkGeneric(content, lines, language);
}

function chunkGeneric(content: string, lines: string[], language: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  let chunkIndex = 0;
  const linesPerChunk = Math.ceil(MAX_CHUNK_SIZE / 80);

  for (let i = 0; i < lines.length; i += linesPerChunk - OVERLAP_LINES) {
    const end = Math.min(i + linesPerChunk, lines.length);
    const chunkContent = lines.slice(i, end).join('\n').trim();
    if (chunkContent.length >= MIN_CHUNK_SIZE) {
      chunks.push({ content: chunkContent, chunkIndex: chunkIndex++, chunkType: 'block', language, startLine: i + 1, endLine: end, imports: [], exports: [] });
    }
  }
  return chunks;
}

function chunkWithBraces(content: string, lines: string[], language: string, patterns: { regex: RegExp; type: CodeChunk['chunkType'] }[]): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  let chunkIndex = 0;

  const importBlock = extractImportBlock(lines, language);
  if (importBlock) {
    chunks.push({ content: importBlock.content, chunkIndex: chunkIndex++, chunkType: 'import', language, startLine: importBlock.startLine, endLine: importBlock.endLine, imports: extractImports(importBlock.content, language), exports: [] });
  }

  const symbols = findSymbolBoundaries(lines, patterns, '{', '}');
  for (const sym of symbols) {
    const chunkContent = lines.slice(sym.startLine - 1, sym.endLine).join('\n');
    if (chunkContent.length > MAX_CHUNK_SIZE) {
      const subChunks = splitLargeChunk(chunkContent, sym.startLine, language, sym.type, sym.name);
      for (const sub of subChunks) { sub.chunkIndex = chunkIndex++; chunks.push(sub); }
    } else if (chunkContent.length >= MIN_CHUNK_SIZE) {
      chunks.push({ content: chunkContent, chunkIndex: chunkIndex++, chunkType: sym.type, language, startLine: sym.startLine, endLine: sym.endLine, symbolName: sym.name, symbolType: sym.type, imports: [], exports: sym.exported ? [sym.name] : [] });
    }
  }
  return addUncoveredChunks(chunks, lines, language, chunkIndex);
}

interface SymbolBoundary {
  name: string;
  type: CodeChunk['chunkType'];
  startLine: number;
  endLine: number;
  exported: boolean;
}

function findSymbolBoundaries(lines: string[], patterns: { regex: RegExp; type: CodeChunk['chunkType'] }[], openBrace: string, closeBrace: string): SymbolBoundary[] {
  const symbols: SymbolBoundary[] = [];
  let i = 0;

  while (i < lines.length) {
    let matched = false;
    for (const pattern of patterns) {
      const match = lines[i].match(pattern.regex);
      if (match) {
        const name = match[1] || 'anonymous';
        const exported = lines[i].trimStart().startsWith('export');
        const startLine = i + 1;
        let depth = 0;
        let j = i;
        let foundOpen = false;

        while (j < lines.length) {
          for (const ch of lines[j]) {
            if (ch === openBrace.charAt(0)) { depth++; foundOpen = true; }
            if (ch === closeBrace.charAt(0)) depth--;
          }
          j++;
          if (foundOpen && depth <= 0) break;
          if (!foundOpen && j > i + 1 && lines[j - 1].trim() === '') break;
        }

        symbols.push({ name, type: pattern.type, startLine, endLine: j, exported });
        i = j;
        matched = true;
        break;
      }
    }
    if (!matched) i++;
  }
  return symbols;
}

function extractImportBlock(lines: string[], language: string): { content: string; startLine: number; endLine: number } | null {
  const importLines: number[] = [];
  for (let i = 0; i < Math.min(lines.length, 100); i++) {
    const trimmed = lines[i].trim();
    if (language === 'go') {
      if (trimmed.startsWith('import') || (importLines.length > 0 && trimmed !== ')' && !trimmed.startsWith('func') && !trimmed.startsWith('type') && !trimmed.startsWith('var') && !trimmed.startsWith('const'))) {
        importLines.push(i);
        if (trimmed === ')') break;
      }
    } else {
      if (trimmed.startsWith('import ') || trimmed.startsWith('require(') || trimmed.startsWith('use ') || trimmed.startsWith('from ')) {
        importLines.push(i);
      }
    }
  }
  if (importLines.length === 0) return null;
  const start = importLines[0];
  const end = importLines[importLines.length - 1] + 1;
  return { content: lines.slice(start, end).join('\n'), startLine: start + 1, endLine: end };
}

function splitLargeChunk(content: string, startLine: number, language: string, type: CodeChunk['chunkType'], name: string): CodeChunk[] {
  const lines = content.split('\n');
  const linesPerChunk = Math.ceil(MAX_CHUNK_SIZE / 80);
  const chunks: CodeChunk[] = [];

  for (let i = 0; i < lines.length; i += linesPerChunk - OVERLAP_LINES) {
    const end = Math.min(i + linesPerChunk, lines.length);
    const chunkContent = lines.slice(i, end).join('\n').trim();
    if (chunkContent.length >= MIN_CHUNK_SIZE) {
      chunks.push({
        content: chunkContent,
        chunkIndex: 0,
        chunkType: type,
        language,
        startLine: startLine + i,
        endLine: startLine + end - 1,
        symbolName: i === 0 ? name : `${name}_part${Math.floor(i / (linesPerChunk - OVERLAP_LINES)) + 1}`,
        symbolType: type,
        imports: [],
        exports: [],
      });
    }
  }
  return chunks;
}

function addUncoveredChunks(chunks: CodeChunk[], lines: string[], language: string, startIndex: number): CodeChunk[] {
  const covered = new Set<number>();
  for (const c of chunks) {
    for (let i = c.startLine; i <= c.endLine; i++) covered.add(i);
  }
  const uncovered = findUncoveredRanges(lines.length, covered);
  let chunkIndex = startIndex;
  for (const range of uncovered) {
    const blockContent = lines.slice(range.start - 1, range.end).join('\n').trim();
    if (blockContent.length >= MIN_CHUNK_SIZE) {
      chunks.push({ content: blockContent.slice(0, MAX_CHUNK_SIZE), chunkIndex: chunkIndex++, chunkType: 'block', language, startLine: range.start, endLine: range.end, imports: [], exports: [] });
    }
  }
  return chunks;
}

function findUncoveredRanges(totalLines: number, covered: Set<number>): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let rangeStart: number | null = null;

  for (let i = 1; i <= totalLines; i++) {
    if (!covered.has(i)) {
      if (rangeStart === null) rangeStart = i;
    } else {
      if (rangeStart !== null) {
        ranges.push({ start: rangeStart, end: i - 1 });
        rangeStart = null;
      }
    }
  }
  if (rangeStart !== null) ranges.push({ start: rangeStart, end: totalLines });
  return ranges;
}

function extractImports(content: string, language: string): string[] {
  const imports: string[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (language === 'python') {
      if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) imports.push(trimmed);
    } else if (language === 'go') {
      if (trimmed.startsWith('import ') || (trimmed.startsWith('"') && trimmed.endsWith('"'))) imports.push(trimmed);
    } else if (language === 'rust') {
      if (trimmed.startsWith('use ')) imports.push(trimmed);
    } else {
      if (trimmed.startsWith('import ') || trimmed.includes('require(')) imports.push(trimmed);
    }
  }
  return imports;
}

function extractExports(content: string, language: string): string[] {
  const exports: string[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('export ')) {
      const match = trimmed.match(/export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/);
      if (match) exports.push(match[1]);
    }
    if (language === 'python' && trimmed.startsWith('__all__')) {
      const allMatch = trimmed.match(/__all__\s*=\s*\[([^\]]+)\]/);
      if (allMatch) exports.push(...allMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')));
    }
    if (language === 'go' && /^func\s+[A-Z]/.test(trimmed)) {
      const match = trimmed.match(/^func\s+(?:\(\w+\s+\*?\w+\)\s+)?([A-Z]\w+)/);
      if (match) exports.push(match[1]);
    }
  }
  return exports;
}
