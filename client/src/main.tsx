import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./critical.css";


const deferredInit = () => {
  import('./index.css');
  import("./i18n");
  
  import("./utils/dynamic-vh").then(({ setupDynamicVH }) => {
    setupDynamicVH();
  });
  
  import("./lib/telemetry").then(({ initTelemetry }) => {
    initTelemetry({
      enabled: true,
      debug: import.meta.env.DEV,
      batchSize: 10,
      flushInterval: 5000,
    });
  });
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(r => r.unregister());
    });
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
  }
};

if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(deferredInit, { timeout: 3000 });
  } else {
    requestAnimationFrame(() => setTimeout(deferredInit, 100));
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

const initialLoader = document.getElementById('initial-loader');
if (initialLoader) {
  initialLoader.classList.add('hidden');
}
