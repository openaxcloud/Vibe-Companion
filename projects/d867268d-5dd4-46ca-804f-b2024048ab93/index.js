// filename: index.js
const products = [
    { id: 1, name: "Product 1", price: 10 },
    { id: 2, name: "Product 2", price: 20 },
    { id: 3, name: "Product 3", price: 30 },
];

let cart = [];

function displayProducts() {
    const productList = document.getElementById("product-list");
    productList.innerHTML = '';
    products.forEach(product => {
        const productDiv = document.createElement("div");
        productDiv.className = 'product';
        productDiv.innerHTML = `
            <h3>${product.name}</h3>
            <p>Price: $${product.price}</p>
            <button onclick="addToCart(${product.id})">Add to Cart</button>
        `;
        productList.appendChild(productDiv);
    });
}

function addToCart(id) {
    const product = products.find(p => p.id === id);
    cart.push(product);
    document.getElementById("cart-count").innerText = cart.length;
}

document.getElementById("search").addEventListener("input", function() {
    const query = this.value.toLowerCase();
    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(query));
    displayFilteredProducts(filteredProducts);
});

function displayFilteredProducts(filteredProducts) {
    const productList = document.getElementById("product-list");
    productList.innerHTML = '';
    filteredProducts.forEach(product => {
        const productDiv = document.createElement("div");
        productDiv.className = 'product';
        productDiv.innerHTML = `
            <h3>${product.name}</h3>
            <p>Price: $${product.price}</p>
            <button onclick="addToCart(${product.id})">Add to Cart</button>
        `;
        productList.appendChild(productDiv);
    });
}

displayProducts();