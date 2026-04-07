const express = require('express');
const WebSocket = require('ws');
const app = express();
const port = 3000;

// Create HTTP server
const server = app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

let clients = [];

wss.on('connection', (ws) => {
    clients.push(ws);
    ws.on('message', (message) => {
        // Broadcast message to all clients
        clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        clients = clients.filter(client => client !== ws);
    });
});