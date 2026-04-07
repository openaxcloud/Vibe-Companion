const socket = new WebSocket('ws://localhost:3000');

socket.onopen = function() {
    console.log('Connected to the WebSocket server.');
};

socket.onmessage = function(event) {
    const messageData = JSON.parse(event.data);
    displayMessage(messageData);
};

document.getElementById('sendMessage').addEventListener('click', function() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value;
    if (message) {
        const messageData = { type: 'message', content: message };
        socket.send(JSON.stringify(messageData));
        messageInput.value = '';
    }
});

function displayMessage(messageData) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.textContent = messageData.content;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}