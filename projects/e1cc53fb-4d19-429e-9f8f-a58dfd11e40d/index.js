// filename: index.js
document.addEventListener('DOMContentLoaded', () => {
    const companies = [
        { name: "Walmart", sector: "Retail", revenue: 559.2 },
        { name: "Amazon", sector: "Technology", revenue: 386.1 },
        { name: "Apple", sector: "Technology", revenue: 274.5 },
        // Ajoutez plus de données ici
    ];

    const tableBody = document.querySelector('#companies-table tbody');
    companies.forEach(company => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${company.name}</td>
            <td>${company.sector}</td>
            <td>${company.revenue}</td>
        `;
        tableBody.appendChild(row);
    });
});