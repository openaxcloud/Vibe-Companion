import './lib/patchSyncExternalStore';
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error diagnostics — helps debug blank/stuck pages on Replit
window.addEventListener("error", (e) => {
  console.error("[GLOBAL ERROR]", e.message, e.filename, e.lineno, e.colno, e.error);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[UNHANDLED REJECTION]", e.reason);
});

const buildMeta = document.querySelector('meta[name="build-time"]');
const BUILD_TS = buildMeta?.getAttribute('content') || 'unknown';
console.log(`[main.tsx] React app mounting — build: ${BUILD_TS}`);

try {
  createRoot(document.getElementById("root")!).render(<App />);
  console.log("[main.tsx] React app mounted successfully");
} catch (err) {
  console.error("[main.tsx] Failed to mount React app:", err);
  // Show a visible error if React fails to mount
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="padding:2rem;color:red;font-family:monospace;">
      <h2>App failed to load</h2>
      <pre>${err instanceof Error ? err.message + "\n" + err.stack : String(err)}</pre>
    </div>`;
  }
}
