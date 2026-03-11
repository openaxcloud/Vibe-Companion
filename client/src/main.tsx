import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const origConsoleError = console.error;
console.error = (...args: any[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('change in the order of Hooks') || msg.includes('Rendered more hooks')) {
    const full = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'hook_error_full', properties: { message: full.slice(0, 5000) } }),
    }).catch(() => {});
  }
  origConsoleError.apply(console, args);
};

createRoot(document.getElementById("root")!).render(<App />);
