
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    image_url TEXT,
    category_id UUID REFERENCES categories(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory (
    product_id UUID PRIMARY KEY REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    total_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, cancelled, shipped
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id),
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL
);

-- Initial categories
INSERT INTO categories (name) VALUES ('Electronics'), ('Clothing'), ('Books'), ('Home & Kitchen');

-- Dummy products
INSERT INTO products (name, description, price, image_url, category_id) VALUES
('Wireless Bluetooth Headphones', 'High-quality sound with noise cancellation.', 99.99, 'https://via.placeholder.com/300x300?text=Headphones', (SELECT id FROM categories WHERE name = 'Electronics')),
('Men's T-Shirt', 'Comfortable cotton t-shirt.', 24.99, 'https://via.placeholder.com/300x300?text=T-Shirt', (SELECT id FROM categories WHERE name = 'Clothing')),
('The Great Adventure Book', 'An exciting fantasy novel.', 15.00, 'https://via.placeholder.com/300x300?text=Book', (SELECT id FROM categories WHERE name = 'Books')),
('Smart Coffee Maker', 'Brew your coffee with a touch of a button.', 79.99, 'https://via.placeholder.com/300x300?text=Coffee+Maker', (SELECT id FROM categories WHERE name = 'Home & Kitchen'));

-- Initial inventory for dummy products
INSERT INTO inventory (product_id, quantity) VALUES
((SELECT id FROM products WHERE name = 'Wireless Bluetooth Headphones'), 50),
((SELECT id FROM products WHERE name = 'Men's T-Shirt'), 100),
((SELECT id FROM products WHERE name = 'The Great Adventure Book'), 75),
((SELECT id FROM products WHERE name = 'Smart Coffee Maker'), 30);
