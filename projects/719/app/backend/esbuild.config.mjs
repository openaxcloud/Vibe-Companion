import { build } from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';
import { rmSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = __dirname;
const SRC_DIR = path.join(BACKEND_DIR, 'src');
const DIST_DIR = path.join(BACKEND_DIR, 'dist');

const ENTRY_FILE = path.join(SRC_DIR, 'server.ts');
const OUT_FILE = path.join(DIST_DIR, 'server.cjs');

function cleanDist() {
  if (existsSync(DIST_DIR)) {
    rmSync(DIST_DIR, { recursive: true, force: true });
  }
  mkdirSync(DIST_DIR, { recursive: true });
}

function writeMetaFile(meta, filePath) {
  const json = JSON.stringify(meta, null, 2);
  writeFileSync(filePath, json, 'utf8');
}

async function buildBackend({ watch = false, minify = false } = {}) {
  cleanDist();

  const commonOptions = {
    entryPoints: [ENTRY_FILE],
    platform: 'node',
    format: 'cjs',
    target: ['node18'],
    outfile: OUT_FILE,
    bundle: true,
    sourcemap: true,
    logLevel: 'info',
    color: true,
    tsconfig: path.join(ROOT_DIR, 'tsconfig.json'),
    plugins: [
      nodeExternalsPlugin({
        allowList: [],
        packagePath: path.join(BACKEND_DIR, 'package.json'),
      }),
    ],
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV || (watch ? 'development' : 'production')
      ),
      'process.env.IS_BACKEND': 'true',
    },
  };

  if (watch) {
    const ctx = await build({
      ...commonOptions,
      minify: false,
      metafile: true,
      incremental: true,
      watch: {
        onRebuild(error, result) {
          if (error) {
            // eslint-disable-next-line no-console
            console.error('Backend rebuild failed:', error);
          } else if (result?.metafile) {
            writeMetaFile(
              result.metafile,
              path.join(DIST_DIR, 'meta-backend-watch.json')
            );
            // eslint-disable-next-line no-console
            console.log('Backend rebuilt successfully');
          }
        },
      },
    });

    if (ctx?.metafile) {
      writeMetaFile(ctx.metafile, path.join(DIST_DIR, 'meta-backend-initial.json'));
    }

    return ctx;
  }

  const result = await build({
    ...commonOptions,
    minify,
    metafile: true,
  });

  if (result.metafile) {
    writeMetaFile(result.metafile, path.join(DIST_DIR, 'meta-backend.json'));
  }

  return result;
}

async function run() {
  const mode = process.env.BACKEND_BUILD_MODE || 'build';
  const minify = process.env.MINIFY === 'true';

  if (mode === 'watch') {
    await buildBackend({ watch: true, minify: false });
  } else {
    await buildBackend({ watch: false, minify });
  }
}

if (import.meta.url === `file://undefined`) {
  run().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}

export default buildBackend;