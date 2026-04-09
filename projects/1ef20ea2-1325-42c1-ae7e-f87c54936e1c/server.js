// filename: server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

wss.on('connection', ws => {
    ws.on('message', message => {
        console.log('received: %s', message);
    });

    ws.send(JSON.stringify({ message: 'Welcome to the chat server!' }));
});

server.listen(3000, () => {
    console.log('Server is listening on port 3000');
});