// filename: app.js
document.addEventListener('DOMContentLoaded', () => {
    const productList = document.getElementById('product-list');
    const cartItems = document.getElementById('cart-items');
    const checkoutButton = document.getElementById('checkout');

    let cart = [];

    // Sample product data
    const products = [
        { id: 1, name: "Product 1", price: 29.99 },
        { id: 2, name: "Product 2", price: 19.99 },
        { id: 3, name: "Product 3", price: 39.99 },
    ];

    function displayProducts() {
        productList.innerHTML = '';
        products.forEach(product => {
            const div = document.createElement('div');
            div.innerHTML = `<h3>${product.name}</h3><p>$${product.price}</p><button onclick="addToCart(${product.id})">Add to Cart</button>`;
            productList.appendChild(div);
        });
    }

    window.addToCart = (id) => {
        const product = products.find(p => p.id === id);
        cart.push(product);
        updateCart();
    };

    function updateCart() {
        cartItems.innerHTML = '';
        cart.forEach(item => {
            const div = document.createElement('div');
            div.innerHTML = `<p>${item.name} - $${item.price}</p>`;
            cartItems.appendChild(div);
        });
    }

    checkoutButton.addEventListener('click', () => {
        alert('Proceeding to checkout...');
        // Integrate Stripe API here
    });

    displayProducts();
});