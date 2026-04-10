// filename: script.js
document.addEventListener('DOMContentLoaded', () => {
    const companies = [
        { name: 'Walmart', rank: 1, revenue: '523.96 billion USD' },
        { name: 'Amazon', rank: 2, revenue: '280.52 billion USD' },
        { name: 'Apple', rank: 3, revenue: '260.17 billion USD' },
        // Ajoutez plus d'entreprises ici
    ];

    const companiesList = document.getElementById('companies-list');

    companies.forEach(company => {
        const companyCard = document.createElement('div');
        companyCard.className = 'company-card';
        companyCard.innerHTML = `
            <h2>${company.name}</h2>
            <p>Rank: ${company.rank}</p>
            <p>Revenue: ${company.revenue}</p>
        `;
        companiesList.appendChild(companyCard);
    });
});