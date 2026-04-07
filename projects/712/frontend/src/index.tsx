import React, { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "./theme/ThemeProvider";
import { GlobalStateProvider } from "./state/GlobalStateProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container with id 'root' not found in index.html");
}

const root = ReactDOM.createRoot(container);

root.render(
  <StrictMode>
    <ErrorBoundary>
      <GlobalStateProvider>
        <ThemeProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ThemeProvider>
      </GlobalStateProvider>
    </ErrorBoundary>
  </StrictMode>
);

if (import.meta && (import.meta as any).hot) {
  (import.meta as any).hot.accept();
}