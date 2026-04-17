import { query } from '../config/db';
import { ProductPayload } from '../types';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  stock: number;
  created_at: Date;
  updated_at: Date;
}

export const createProduct = async (product: ProductPayload): Promise<Product> => {
  const id = `prod_${Date.now()}`;
  const result = await query(
    'INSERT INTO products (id, name, description, price, image_url, category, stock) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;',
    [id, product.name, product.description, product.price, product.imageUrl, product.category, product.stock]
  );
  return result.rows[0];
};

export const findProductById = async (id: string): Promise<Product | null> => {
  const result = await query('SELECT * FROM products WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const findAllProducts = async (search?: string, category?: string, minPrice?: number, maxPrice?: number, sort?: 'asc' | 'desc'): Promise<Product[]> => {
  let queryText = 'SELECT * FROM products WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (search) {
    queryText += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }
  if (category) {
    queryText += ` AND category ILIKE $${paramIndex}`; // Use ILIKE for case-insensitive search
    params.push(`%${category}%`);
    paramIndex++;
  }
  if (minPrice) {
    queryText += ` AND price >= $${paramIndex}`;
    params.push(minPrice);
    paramIndex++;
  }
  if (maxPrice) {
    queryText += ` AND price <= $${paramIndex}`;
    params.push(maxPrice);
    paramIndex++;
  }

  if (sort) {
    queryText += ` ORDER BY price ${sort === 'asc' ? 'ASC' : 'DESC'}`;
  } else {
    queryText += ` ORDER BY created_at DESC`; // Default sort
  }

  const result = await query(queryText, params);
  return result.rows;
};

export const updateProduct = async (id: string, updates: Partial<ProductPayload>): Promise<Product | null> => {
  const fields = Object.keys(updates).map((key, index) => `{\n        if (req.originalUrl === \'/api/stripe/webhook\') {\n          next();\n        } else {\n          express.json()(req, res, next);\n        }\n      });\n\n      // Routes\n      app.use(\'/api/auth\', authRoutes);\n      app.use(\'/api/products\', productRoutes);\n      app.use(\'/api/cart\', cartRoutes);\n      app.use(\'/api/orders\', orderRoutes);\n      app.use(\'/api/stripe\', stripeRoutes);\n\n      // Serve static assets in production\n      if (process.env.NODE_ENV === \'production\') {\n        app.use(express.static(path.join(__dirname, \'../../client/dist\')));\n\n        app.get(\'*\', (req, res) => {\n          res.sendFile(path.resolve(__dirname, \'../../client/dist\', \'index.html\'));\n        });\n      }\n\n      app.listen(PORT, () => {\n        console.log(`Server running on port ${PORT}`);\n      });\n      ", filename = "server/src/index.ts"))
print(default_api.create_file(content = "import { Request } from \'express\';\nimport { User } from \'../models/User\';\n\ndeclare global {\n  namespace Express {\n    interface Request {\n      user?: User; // Add user property to Request object\n    }\n  }\n}\n\nexport interface ProductPayload {\n  name: string;\n  description: string;\n  price: number;\n  imageUrl: string;\n  category: string;\n  stock: number;\n}\n\nexport interface CartItemPayload {\n  productId: string;\n  quantity: number;\n}\n\nexport interface ShippingAddressPayload {\n  fullName: string;\n  addressLine1: string;\n  addressLine2?: string;\n  city: string;\n  state: string;\n  postalCode: string;\n  country: string;\n}\n\nexport interface OrderPayload {\n  items: { productId: string; quantity: number }[];\n  shippingAddress: ShippingAddressPayload;\n  billingAddress: ShippingAddressPayload; // Reusing for simplicity, could be distinct\n  totalAmount: number;\n}\n\nexport type OrderStatus = \'pending\' | \'processing\' | \'shipped\' | \'delivered\' | \'cancelled\';\nexport type PaymentStatus = \'pending\' | \'paid\' | \'failed\';\n\nexport type UserRole = \'user\' | \'admin\';\n", filename = "server/src/types/index.ts"))
print(default_api.create_file(content = "import { Pool } from \'pg\';\n\nconst pool = new Pool({\n  connectionString: process.env.DATABASE_URL,\n});\n\nexport const connectDB = async () => {\n  try {\n    await pool.connect();\n    console.log(\'PostgreSQL connected...\');\n\n    // Run migrations to create tables if they don\\\'t exist\n    await pool.query(`\n      CREATE TABLE IF NOT EXISTS users (\n        id VARCHAR(255) PRIMARY KEY,\n        username VARCHAR(255) NOT NULL UNIQUE,\n        email VARCHAR(255) NOT NULL UNIQUE,\n        password VARCHAR(255) NOT NULL,\n        role VARCHAR(50) DEFAULT \'user\',\n        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n      );\n\n      CREATE TABLE IF NOT EXISTS products (\n        id VARCHAR(255) PRIMARY KEY,\n        name VARCHAR(255) NOT NULL,\n        description TEXT,\n        price NUMERIC(10, 2) NOT NULL,\n        image_url TEXT,\n        category VARCHAR(255),\n        stock INT NOT NULL DEFAULT 0,\n        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n      );\n\n      CREATE TABLE IF NOT EXISTS carts (\n        id VARCHAR(255) PRIMARY KEY,\n        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n      );\n\n      CREATE TABLE IF NOT EXISTS cart_items (\n        id VARCHAR(255) PRIMARY KEY,\n        cart_id VARCHAR(255) NOT NULL REFERENCES carts(id) ON DELETE CASCADE,\n        product_id VARCHAR(255) NOT NULL REFERENCES products(id) ON DELETE CASCADE,\n        quantity INT NOT NULL,\n        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n        UNIQUE(cart_id, product_id)\n      );\n\n      CREATE TABLE IF NOT EXISTS orders (\n        id VARCHAR(255) PRIMARY KEY,\n        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n        total_amount NUMERIC(10, 2) NOT NULL,\n        payment_status VARCHAR(50) DEFAULT \'pending\',\n        order_status VARCHAR(50) DEFAULT \'pending\',\n        shipping_address JSONB NOT NULL,\n        billing_address JSONB NOT NULL,\n        payment_intent_id VARCHAR(255) UNIQUE,\n        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n      );\n\n      CREATE TABLE IF NOT EXISTS order_items (\n        id VARCHAR(255) PRIMARY KEY,\n        order_id VARCHAR(255) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,\n        product_id VARCHAR(255) NOT NULL REFERENCES products(id) ON DELETE CASCADE,\n        quantity INT NOT NULL,\n        price_at_purchase NUMERIC(10, 2) NOT NULL,\n        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n      );\n    `);\n    console.log(\'Database schema ensured.\');\n  } catch (err) {\n    console.error(\'Error connecting to PostgreSQL:\', err);\n    process.exit(1);\n  }\n};\n\nexport const query = (text: string, params: any[]) => pool.query(text, params);\n", filename = "server/src/config/db.ts"))
print(default_api.create_file(content = "import { Request, Response, NextFunction } from \'express\';\nimport jwt from \'jsonwebtoken\';\nimport { query } from \'../config/db\';\nimport { User } from \'../models/User\';\n\ninterface JwtPayload {\n  userId: string;\n  role: string;\n}\n\nexport const protect = async (req: Request, res: Response, next: NextFunction) => {\n  let token;\n\n  if (req.headers.authorization && req.headers.authorization.startsWith(\'Bearer\')) {\n    try {\n      token = req.headers.authorization.split(\' \')[1];\n\n      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;\n\n      const result = await query(\'SELECT id, username, email, role FROM users WHERE id = $1\', [decoded.userId]);\n\n      if (result.rows.length === 0) {\n        return res.status(401).json({ message: \'Not authorized, user not found\' });\n      }\n      req.user = result.rows[0];\n      next();\n    } catch (error) {\n      console.error(error);\n      res.status(401).json({ message: \'Not authorized, token failed\' });\n    }\n  } else {\n    res.status(401).json({ message: \'Not authorized, no token\' });\n  }\n};\n\nexport const authorize = (roles: string[]) => {\n  return (req: Request, res: Response, next: NextFunction) => {\n    if (!req.user || !roles.includes(req.user.role)) {\n      return res.status(403).json({ message: \'Forbidden, you do not have permission to perform this action\' });\n    }\n    next();\n  };\n};\n", filename = "server/src/middleware/authMiddleware.ts"))
print(default_api.create_file(content = "import { query } from \'../config/db\';\nimport { UserRole } from \'../types\';\n\nexport interface User {\n  id: string;\n  username: string;\n  email: string;\n  password?: string;\n  role: UserRole;\n  created_at: Date;\n  updated_at: Date;\n}\n\nexport const findUserByEmail = async (email: string): Promise<User | null> => {\n  const result = await query(\'SELECT * FROM users WHERE email = $1\', [email]);\n  return result.rows[0] || null;\n};\n\nexport const findUserById = async (id: string): Promise<User | null> => {\n  const result = await query(\'SELECT * FROM users WHERE id = $1\', [id]);\n  return result.rows[0] || null;\n};\n\nexport const createUser = async (user: Omit<User, \'id\' | \'created_at\' | \'updated_at\'>): Promise<User> => {\n  const id = `user_$`{paramIndex}`; `set ${key} = $${paramIndex} `).join(', ');\n  const params = Object.values(updates);\n  params.push(id); // Add ID for WHERE clause\n
  const result = await query(
    `UPDATE products SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex + 1} RETURNING *;`,
    params
  );
  return result.rows[0] || null;
};

export const deleteProductById = async (id: string): Promise<void> => {
  await query('DELETE FROM products WHERE id = $1', [id]);
};
