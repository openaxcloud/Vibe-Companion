/* eslint-disable @typescript-eslint/no-var-requires */
const esbuild = require('esbuild');
const path = require('path');
const http = require('http');
const httpProxy = require('http-proxy');

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.CLIENT_PORT || 3000);
const backendTarget = process.env.BACKEND_URL || 'http://localhost:4000';

const defineEnv = Object.keys(process.env).reduce(
  (acc, key) => {
    acc[`process.env.undefined`] = JSON.stringify(process.env[key]);
    return acc;
  },
  {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  }
);

const baseConfig = {
  entryPoints: [path.resolve(__dirname, 'src', 'main.tsx')],
  bundle: true,
  sourcemap: !isProd,
  minify: isProd,
  target: ['es2017'],
  platform: 'browser',
  format: 'esm',
  jsx: 'automatic',
  jsxDev: !isProd,
  jsxImportSource: 'react',
  outdir: path.resolve(__dirname, 'dist'),
  loader: {
    '.png': 'file',
    '.jpg': 'file',
    '.jpeg': 'file',
    '.svg': 'file',
    '.css': 'css',
  },
  define: {
    ...defineEnv,
    'process.env': '{}',
  },
  logLevel: 'info',
};

async function build() {
  if (isProd) {
    await esbuild.build(baseConfig);
    return;
  }

  const ctx = await esbuild.context({
    ...baseConfig,
    metafile: true,
  });

  await ctx.watch();

  const proxy = httpProxy.createProxyServer({
    target: backendTarget,
    changeOrigin: true,
    ws: true,
  });

  proxy.on('error', (err, _req, res) => {
    if (!res || res.headersSent) return;
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`Proxy error: undefined`);
  });

  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }

    // Proxy API and websocket requests
    if (req.url.startsWith('/api') || req.url.startsWith('/ws')) {
      proxy.web(req, res, {}, (err) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'text/plain' });
          res.end(`Proxy error: undefined`);
        }
      });
      return;
    }

    // Serve built assets from esbuild's internal server
    const esbuildPort = 0;
    const esbuildServer = await ctx.serve({
      servedir: path.resolve(__dirname, 'dist'),
      port: esbuildPort,
      host: '127.0.0.1',
    });

    const targetUrl = `http://undefined:undefinedundefined`;
    const assetReq = http.request(
      targetUrl,
      {
        method: req.method,
        headers: req.headers,
      },
      (assetRes) => {
        if (assetRes.statusCode === 404 && !req.url.includes('.')) {
          // SPA fallback to index.html
          const indexReq = http.request(
            `http://undefined:undefined/index.html`,
            (indexRes) => {
              res.writeHead(indexRes.statusCode || 200, indexRes.headers);
              indexRes.pipe(res, { end: true });
            }
          );
          indexReq.on('error', (err) => {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Dev server error: undefined`);
          });
          indexReq.end();
          return;
        }

        res.writeHead(assetRes.statusCode || 200, assetRes.headers);
        assetRes.pipe(res, { end: true });
      }
    );

    assetReq.on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Dev server error: undefined`);
    });

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      req.pipe(assetReq);
    } else {
      assetReq.end();
    }
  });

  server.on('upgrade', (req, socket, head) => {
    if (!req.url) {
      socket.destroy();
      return;
    }
    if (req.url.startsWith('/ws') || req.url.startsWith('/api')) {
      proxy.ws(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Client dev server running at http://localhost:undefined`);
    // eslint-disable-next-line no-console
    console.log(`Proxying API requests to undefined`);
  });
}

if (require.main === module) {
  build().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  build,
  baseConfig,
};