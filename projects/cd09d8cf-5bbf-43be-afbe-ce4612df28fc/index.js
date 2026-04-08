// filename: index.js
const socket = new WebSocket('ws://localhost:3000');
const messageList = document.getElementById('message-list');
const messageInput = document.getElementById('message-input');
const sendMessageButton = document.getElementById('send-message');

socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    displayMessage(message);
};

sendMessageButton.onclick = () => {
    const messageText = messageInput.value;
    if (messageText) {
        const message = { text: messageText, user: 'User1' };
        socket.send(JSON.stringify(message));
        messageInput.value = '';
    }
};

function displayMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = `${message.user}: ${message.text}`;
    messageList.appendChild(messageElement);
}