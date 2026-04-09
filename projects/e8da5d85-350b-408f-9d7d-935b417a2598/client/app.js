// filename: client/app.js

const socket = new WebSocket('ws://localhost:3000');

const chatWindow = document.getElementById('chat-window');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

sendButton.addEventListener('click', () => {
    const message = messageInput.value;
    if (message) {
        socket.send(message);
        addMessageToWindow('You', message);
        messageInput.value = '';
    }
});

socket.onmessage = (event) => {
    addMessageToWindow('Friend', event.data);
};

function addMessageToWindow(user, message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = `${user}: ${message}`;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}