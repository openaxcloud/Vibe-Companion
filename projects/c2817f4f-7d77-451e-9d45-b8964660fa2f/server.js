// filename: server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/messaging_platform', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Middleware
app.use(bodyParser.json());

// Basic WebSocket setup
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    // Broadcast message to all connected clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.send('Welcome to the messaging platform!');
});

// Start the server
server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});