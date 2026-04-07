/* eslint-disable @typescript-eslint/no-var-requires */
const esbuild = require('esbuild');
const path = require('path');
const { builtinModules } = require('module');

const isWatch = process.argv.includes('--watch') || process.env.WATCH === 'true';
const isDev = process.env.NODE_ENV !== 'production';

const entryFile = path.resolve(__dirname, 'src', 'server.ts');
const outdir = path.resolve(__dirname, 'dist');

const external = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:undefined`),
];

const commonOptions = {
  entryPoints: [entryFile],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: ['node18'],
  sourcemap: isDev,
  minify: !isDev,
  outfile: path.join(outdir, 'server.cjs'),
  external,
  logLevel: 'info',
};

async function build() {
  if (isWatch) {
    const ctx = await esbuild.context(commonOptions);
    await ctx.watch();
    // eslint-disable-next-line no-console
    console.log('esbuild watching for changes...');
  } else {
    await esbuild.build(commonOptions);
  }
}

build().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});