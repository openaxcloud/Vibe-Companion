// filename: index.js
document.addEventListener('DOMContentLoaded', function() {
    const totalUsersElement = document.getElementById('total-users');
    const activeUsersElement = document.getElementById('active-users');
    const totalRevenueElement = document.getElementById('total-revenue');

    // Simulated data
    const totalUsers = 1000;
    const activeUsers = 300;
    const totalRevenue = 50000;

    totalUsersElement.textContent = totalUsers;
    activeUsersElement.textContent = activeUsers;
    totalRevenueElement.textContent = `$${totalRevenue}`;

    // Chart.js example
    const lineChartCtx = document.getElementById('lineChart').getContext('2d');
    const lineChart = new Chart(lineChartCtx, {
        type: 'line',
        data: {
            labels: ['January', 'February', 'March', 'April', 'May'],
            datasets: [{
                label: 'Revenue',
                data: [12000, 19000, 30000, 50000, 45000],
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        }
    });

    // Add similar chart initializations for barChart and pieChart...

    // Example data to populate the table
    const users = [
        { name: 'John Doe', email: 'john@example.com', status: 'Active' },
        { name: 'Jane Smith', email: 'jane@example.com', status: 'Inactive' }
    ];

    const tableBody = document.querySelector('#data-table tbody');
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${user.name}</td><td>${user.email}</td><td>${user.status}</td>`;
        tableBody.appendChild(row);
    });
});