// filename: index.js

const socket = new WebSocket('ws://localhost:3000');

const messages = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

sendButton.addEventListener('click', () => {
    const message = messageInput.value;
    if (message) {
        socket.send(message);
        messageInput.value = '';
        displayMessage(`You: ${message}`);
    }
});

socket.onmessage = (event) => {
    displayMessage(event.data);
};

function displayMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messages.appendChild(messageElement);
}