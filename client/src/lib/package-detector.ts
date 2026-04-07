// Detects missing packages from import statements and suggests installation

export interface DetectedPackage {
  name: string;
  importStatement: string;
  line: number;
  isDevDependency: boolean;
}

// Common package patterns for auto-detection
export const PACKAGE_PATTERNS: Record<string, string> = {
  'react': 'react',
  'useState': 'react',
  'useEffect': 'react',
  'useCallback': 'react',
  'useMemo': 'react',
  'useRef': 'react',
  'useContext': 'react',
  'useReducer': 'react',
  'express': 'express',
  'axios': 'axios',
  'lodash': 'lodash',
  'moment': 'moment',
  'dayjs': 'dayjs',
  'zod': 'zod',
  'prisma': '@prisma/client',
  'trpc': '@trpc/server',
  'nextAuth': 'next-auth',
  'mongoose': 'mongoose',
  'sequelize': 'sequelize',
  'pg': 'pg',
  'redis': 'redis',
  'socket.io': 'socket.io',
  'graphql': 'graphql',
  'apollo': '@apollo/client',
  'tailwind': 'tailwindcss',
  'framer': 'framer-motion',
};

// Common Node.js built-in modules that don't need installation
const BUILTIN_MODULES = new Set([
  'fs', 'path', 'http', 'https', 'url', 'util', 'os', 'crypto',
  'events', 'stream', 'buffer', 'querystring', 'assert', 'child_process',
  'cluster', 'dgram', 'dns', 'net', 'readline', 'tls', 'tty', 'v8',
  'vm', 'zlib', 'worker_threads', 'perf_hooks', 'async_hooks', 'timers',
  'fs/promises', 'node:fs', 'node:path', 'node:http', 'node:https',
  'node:crypto', 'node:util', 'node:os', 'node:events', 'node:stream',
]);

// Patterns that indicate dev dependencies
const DEV_DEPENDENCY_PATTERNS = [
  /^@types\//,
  /^eslint/,
  /^prettier/,
  /^jest/,
  /^vitest/,
  /^@testing-library/,
  /^ts-/,
  /^typescript/,
];

export function extractPackageName(importPath: string): string | null {
  // Skip relative imports
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    return null;
  }
  
  // Skip built-in modules
  if (BUILTIN_MODULES.has(importPath) || BUILTIN_MODULES.has(importPath.replace('node:', ''))) {
    return null;
  }
  
  // Handle scoped packages (@org/package)
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  
  // Regular package - get the first part before any /
  return importPath.split('/')[0];
}

export function detectPackagesInCode(code: string): DetectedPackage[] {
  const packages: DetectedPackage[] = [];
  const lines = code.split('\n');
  
  // Match import and require statements
  const importRegex = /(?:import\s+.*?\s+from\s+['"](.+?)['"]|require\s*\(\s*['"](.+?)['"]\s*\))/g;
  
  lines.forEach((line, index) => {
    let match;
    importRegex.lastIndex = 0;
    
    while ((match = importRegex.exec(line)) !== null) {
      const importPath = match[1] || match[2];
      const packageName = extractPackageName(importPath);
      
      if (packageName) {
        const isDevDependency = DEV_DEPENDENCY_PATTERNS.some(p => p.test(packageName));
        
        packages.push({
          name: packageName,
          importStatement: line.trim(),
          line: index + 1,
          isDevDependency,
        });
      }
    }
  });
  
  // Remove duplicates
  const seen = new Set<string>();
  return packages.filter(pkg => {
    if (seen.has(pkg.name)) return false;
    seen.add(pkg.name);
    return true;
  });
}

export async function checkInstalledPackages(
  packages: string[],
  installedPackages: Set<string>
): Promise<string[]> {
  return packages.filter(pkg => !installedPackages.has(pkg));
}

export function generateInstallCommand(packages: string[], usePnpm = false): string {
  const regular = packages.filter(p => !DEV_DEPENDENCY_PATTERNS.some(r => r.test(p)));
  const dev = packages.filter(p => DEV_DEPENDENCY_PATTERNS.some(r => r.test(p)));
  
  const commands: string[] = [];
  const pm = usePnpm ? 'pnpm add' : 'npm install';
  
  if (regular.length > 0) {
    commands.push(`${pm} ${regular.join(' ')}`);
  }
  if (dev.length > 0) {
    commands.push(`${pm} -D ${dev.join(' ')}`);
  }
  
  return commands.join(' && ');
}

export function detectMissingPackages(code: string, installedPackages: string[]): string[] {
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  
  const imports = new Set<string>();
  
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const pkg = match[1].split('/')[0];
    if (!pkg.startsWith('.') && !pkg.startsWith('@/')) {
      imports.add(pkg.startsWith('@') ? `${pkg}/${match[1].split('/')[1]}` : pkg);
    }
  }
  
  while ((match = requireRegex.exec(code)) !== null) {
    const pkg = match[1].split('/')[0];
    if (!pkg.startsWith('.')) {
      imports.add(pkg);
    }
  }
  
  // Filter out installed packages and built-in Node modules
  return Array.from(imports).filter(pkg => 
    !installedPackages.includes(pkg) && 
    !pkg.startsWith('node:') &&
    !BUILTIN_MODULES.has(pkg)
  );
}

export function suggestPackageFromPattern(identifier: string): string | null {
  return PACKAGE_PATTERNS[identifier] || null;
}
