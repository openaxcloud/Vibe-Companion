// Basic WebSocket setup
const socket = new WebSocket('ws://localhost:8080');

socket.addEventListener('open', function (event) {
    console.log('Connected to WebSocket server');
});

socket.addEventListener('message', function (event) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.textContent = event.data;
    messagesDiv.appendChild(messageElement);
});

const sendBtn = document.getElementById('sendBtn');
const messageInput = document.getElementById('messageInput');

sendBtn.addEventListener('click', function () {
    const message = messageInput.value;
    if (message) {
        socket.send(message);
        messageInput.value = '';
    }
});

messageInput.addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        sendBtn.click();
    }
});