// filename: index.js
const ws = new WebSocket('ws://localhost:3000');

const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

ws.onmessage = (event) => {
    const messageElement = document.createElement('div');
    messageElement.textContent = event.data;
    messagesContainer.appendChild(messageElement);
};

sendButton.addEventListener('click', () => {
    const message = messageInput.value;
    if (message) {
        ws.send(message);
        messageInput.value = '';
    }
});