import WebSocket from "ws";
import express from "express";
import http from "http";
import bodyParser from "body-parser";
import { MongoClient } from "mongodb";
import cors from "cors";

// Initialize Express
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Set up HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocket.Server({ server });

// Handle WebSocket connections
wss.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("message", (data) => {
    console.log("Received message:", data);
    // Broadcast the message to all connected clients
    wss.clients.forEach((client) => {
      if (client !== socket && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });

  socket.on("close", () => {
    console.log("Client disconnected");
  });
});

// Set up MongoDB connection
const mongoUrl = "mongodb://localhost:27017/slackClone";
MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((client) => {
    console.log("Connected to MongoDB");
    const db = client.db("slackClone");

    // Sample API route to test MongoDB
    app.get("/api/users", async (req, res) => {
      const users = await db.collection("users").find().toArray();
      res.json(users);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});