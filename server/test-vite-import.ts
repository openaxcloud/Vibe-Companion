// Test just vite import

import express from "express";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
const port = 5000;
app.listen(port, "0.0.0.0", () => {
  // Server listening
});