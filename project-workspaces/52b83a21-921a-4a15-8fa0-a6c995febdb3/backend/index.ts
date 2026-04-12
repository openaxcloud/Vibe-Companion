import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());

// WebSocket connection
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle incoming messages
    socket.on('message', (message) => {
        // Broadcast message to all clients
        io.emit('message', message);
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
