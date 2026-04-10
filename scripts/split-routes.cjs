#!/usr/bin/env node
/**
 * split-routes.js
 *
 * Patches server/routes.ts to:
 *  1. Add a DEPRECATED comment at the top of the file
 *  2. Import MainRouter from the already-existing ./routes/index module
 *  3. Call MainRouter.registerRoutes(app) at the end of registerRoutes(),
 *     just before `return httpServer`
 *
 * This is non-destructive: the monolithic routes remain intact so the app
 * keeps working while the modular structure is wired in.
 *
 * Usage:  node scripts/split-routes.js
 */

const fs = require("fs");
const path = require("path");

const ROUTES_FILE = path.join(__dirname, "..", "server", "routes.ts");

console.log(`Reading ${ROUTES_FILE} ...`);
let src = fs.readFileSync(ROUTES_FILE, "utf8");

// ── 1. Add deprecation banner at the very top ──────────────────────────────
const DEPRECATION_COMMENT = `// DEPRECATED: This monolithic file is being migrated to server/routes/ modules.
// New routes should be added to the appropriate file under server/routes/ instead.
// See server/routes/index.ts for the MainRouter that aggregates modular route files.
`;

if (!src.startsWith("// DEPRECATED:")) {
  src = DEPRECATION_COMMENT + src;
  console.log("  ✓ Added deprecation banner");
} else {
  console.log("  · Deprecation banner already present, skipping");
}

// ── 2. Add MainRouter import (after the last top-level import line) ────────
const MAIN_ROUTER_IMPORT = `import { MainRouter } from "./routes/index";`;

if (!src.includes("MainRouter")) {
  // Find the last consecutive import statement block. We look for the line
  // that ends the block of "import ... from" statements near the top.
  // Strategy: insert right before the first non-import, non-blank line that
  // follows the initial import block.
  const importBlockEnd = (() => {
    const lines = src.split("\n");
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (
        trimmed.startsWith("import ") ||
        trimmed.startsWith("} from ") ||
        trimmed.startsWith("  from ")
      ) {
        lastImportIdx = i;
      }
      // Stop scanning after 200 lines — imports are always at the top
      if (i > 200 && lastImportIdx > 0) break;
    }
    return lastImportIdx;
  })();

  if (importBlockEnd >= 0) {
    const lines = src.split("\n");
    lines.splice(importBlockEnd + 1, 0, MAIN_ROUTER_IMPORT);
    src = lines.join("\n");
    console.log(`  ✓ Inserted MainRouter import after line ${importBlockEnd + 1}`);
  } else {
    console.warn("  ⚠ Could not locate import block — prepending import at top");
    src = MAIN_ROUTER_IMPORT + "\n" + src;
  }
} else {
  console.log("  · MainRouter import already present, skipping");
}

// ── 3. Inject MainRouter call before `return httpServer;` ─────────────────
const INJECT_CALL = `
  // Register modular routes from server/routes/ directory
  try {
    const mainRouter = new MainRouter(storage);
    await mainRouter.registerRoutes(app);
    console.log("[routes] Modular routes registered via MainRouter");
  } catch (err: any) {
    console.error("[routes] MainRouter registration failed:", err?.message || err);
  }
`;

// Find the LAST occurrence of `return httpServer;` which closes registerRoutes()
const RETURN_MARKER = "  return httpServer;\n}";
const markerIdx = src.lastIndexOf(RETURN_MARKER);

if (markerIdx === -1) {
  // Fallback: try without trailing newline
  const alt = "  return httpServer;\n}";
  console.warn("  ⚠ Could not find `return httpServer;\\n}` — trying alternate pattern");

  const altIdx = src.lastIndexOf("return httpServer;");
  if (altIdx === -1) {
    console.error("  ✗ Cannot locate `return httpServer;` — aborting injection");
    process.exit(1);
  }

  if (!src.includes("mainRouter.registerRoutes")) {
    src = src.slice(0, altIdx) + INJECT_CALL.trimStart() + "  " + src.slice(altIdx);
    console.log("  ✓ Injected MainRouter call (fallback position)");
  } else {
    console.log("  · MainRouter call already present, skipping");
  }
} else {
  if (!src.includes("mainRouter.registerRoutes")) {
    src =
      src.slice(0, markerIdx) +
      INJECT_CALL +
      src.slice(markerIdx);
    console.log("  ✓ Injected MainRouter call before final return");
  } else {
    console.log("  · MainRouter call already present, skipping");
  }
}

// ── 4. Write patched file back ─────────────────────────────────────────────
fs.writeFileSync(ROUTES_FILE, src, "utf8");
console.log(`\nDone. Patched ${ROUTES_FILE}`);
console.log("Line count:", src.split("\n").length);
