// filename: index.js
document.getElementById('toggle-dark-mode').addEventListener('click', function() {
    document.body.classList.toggle('dark-mode');
});

// Placeholder function to load products
function loadProducts() {
    const catalog = document.getElementById('product-catalog');
    // Simulate fetching products
    const products = [
        { id: 1, name: "Product A", price: "$10" },
        { id: 2, name: "Product B", price: "$20" },
        { id: 3, name: "Product C", price: "$30" }
    ];
    
    products.forEach(product => {
        const productElement = document.createElement('div');
        productElement.className = 'product';
        productElement.innerHTML = `
            <h2>${product.name}</h2>
            <p>Price: ${product.price}</p>
            <button>Add to Cart</button>
        `;
        catalog.appendChild(productElement);
    });
}

// Initially load products
loadProducts();