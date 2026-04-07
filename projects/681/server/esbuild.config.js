import { build } from 'esbuild';
import path from 'path';
import fs from 'fs';

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.resolve(rootDir, 'server');
const outDir = path.resolve(rootDir, 'dist');

// Read dependencies from package.json to externalize them
const pkgPath = path.resolve(rootDir, 'package.json');
let externals = [];

if (fs.existsSync(pkgPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const dependencies = Object.keys(pkg.dependencies || {});
    const peerDependencies = Object.keys(pkg.peerDependencies || {});
    const optionalDependencies = Object.keys(pkg.optionalDependencies || {});
    externals = [...new Set([...dependencies, ...peerDependencies, ...optionalDependencies])];
  } catch (error) {
    console.warn('Warning: Failed to read package.json for externals:', error);
  }
}

// Helper to resolve entry points (default to server/index.ts if exists)
const defaultEntryCandidates = [
  path.join(srcDir, 'index.ts'),
  path.join(srcDir, 'index.tsx'),
  path.join(srcDir, 'index.js'),
  path.join(srcDir, 'index.mts'),
  path.join(srcDir, 'index.mjs'),
];

let entryPoint = defaultEntryCandidates.find((p) => fs.existsSync(p));

if (!entryPoint) {
  throw new Error(
    `No server entry point found. Looked for:\nundefined`
  );
}

const isWatch = process.argv.includes('--watch') || process.argv.includes('-w');

async function runBuild() {
  try {
    await build({
      entryPoints: [entryPoint],
      bundle: true,
      platform: 'node',
      target: ['node18'],
      format: 'cjs',
      sourcemap: true,
      sourcesContent: true,
      outdir: outDir,
      outbase: srcDir,
      logLevel: 'info',
      color: true,
      tsconfig: fs.existsSync(path.resolve(rootDir, 'tsconfig.server.json'))
        ? path.resolve(rootDir, 'tsconfig.server.json')
        : fs.existsSync(path.resolve(rootDir, 'tsconfig.json'))
        ? path.resolve(rootDir, 'tsconfig.json')
        : undefined,
      external: externals,
      metafile: true,
      minify: false,
      platform: 'node',
      loader: {
        '.ts': 'ts',
        '.tsx': 'tsx',
        '.js': 'js',
        '.json': 'json',
      },
      watch: isWatch
        ? {
            onRebuild(error, result) {
              if (error) {
                console.error('Server rebuild failed:', error);
              } else {
                console.log('Server rebuilt successfully at', new Date().toISOString());
                if (result && result.warnings.length > 0) {
                  console.warn('Rebuild warnings:', result.warnings);
                }
              }
            },
          }
        : false,
    });

    console.log(
      `Server build undefined at undefined`
    );
  } catch (err) {
    console.error('Server build failed:', err);
    process.exitCode = 1;
  }
}

runBuild();