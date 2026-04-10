// Test db-init import

import express from "express";
import { initializeDatabase } from "./db-init";

const app = express();
const port = 5000;
app.listen(port, "0.0.0.0", () => {
  // Server listening
});