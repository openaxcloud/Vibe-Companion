// Minimal server to isolate blocking issue

import express from "express";

const app = express();

// Try to start server immediately without any other imports
const port = 5000;
app.listen(port, "0.0.0.0", () => {
  // Server listening
});

// Keep the process alive
setInterval(() => {
  // Server heartbeat
}, 30000);