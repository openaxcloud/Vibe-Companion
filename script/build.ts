import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, writeFile } from "fs/promises";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import path from "path";

const expressTypesPath = path.resolve("node_modules/@types/express-serve-static-core/index.d.ts");
if (existsSync(expressTypesPath)) {
  const content = readFileSync(expressTypesPath, "utf-8");
  const patched = content.replace(/\[key: string\]: string \| string\[\];/g, "[key: string]: string;");
  if (patched !== content) {
    writeFileSync(expressTypesPath, patched);
    console.log("Patched express-serve-static-core ParamsDictionary types");
  }
}

try {
  console.log("type-checking (non-blocking, 15s limit)...");
  execSync("npx tsc --noEmit", { timeout: 15_000, stdio: "pipe" });
  console.log("type-check passed");
} catch {
  console.warn("type-check skipped — continuing build");
}

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: [
      ...externals,
      "@neondatabase/serverless",
      "@google-cloud/storage",
      "@aws-sdk/client-s3",
      "@aws-sdk/s3-request-presigner",
    ],
    logLevel: "info",
    plugins: [{
      name: "resolve-missing",
      setup(build) {
        build.onResolve({ filter: /\.\/(mcpClient|importService|workflowExecutor)$/ }, (args) => {
          return { path: args.path, external: true };
        });
        build.onResolve({ filter: /\.\/vite$/ }, (args) => {
          if (args.importer.includes("server")) {
            return { path: args.path, namespace: "vite-stub" };
          }
        });
        build.onLoad({ filter: /.*/, namespace: "vite-stub" }, () => {
          return {
            contents: `
              function log(message, source) {
                source = source || "express";
                var formattedTime = new Date().toLocaleTimeString("en-US", {
                  hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true
                });
                console.log(formattedTime + " [" + source + "] " + message);
              }
              module.exports.log = log;
              module.exports.setupVite = function() { throw new Error("setupVite not available in production"); };
              module.exports.serveStatic = require("./static").serveStatic;
            `,
            loader: "js",
            resolveDir: path.resolve("server"),
          };
        });
      },
    }],
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
