// filename: login.js
document.getElementById('login-form').addEventListener('submit', function(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Simulate login process
    if (username === 'user' && password === 'password') {
        sessionStorage.setItem('loggedIn', 'true');
        window.location.href = 'index.html';
    } else {
        document.getElementById('error-message').textContent = 'Invalid username or password';
    }
});