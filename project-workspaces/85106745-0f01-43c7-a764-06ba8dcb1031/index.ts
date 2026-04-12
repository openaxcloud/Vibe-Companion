import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';

app.use(cors());
app.use(express.json());

// Sample product data
let products = [
  { id: 1, name: 'Product 1', price: 29.99, description: 'Description for product 1' },
  { id: 2, name: 'Product 2', price: 49.99, description: 'Description for product 2' },
  { id: 3, name: 'Product 3', price: 19.99, description: 'Description for product 3' }
];

// Sample user data (to be replaced with a database)
let users = [];

// Get all products
app.get('/api/products', (req, res) => {
  res.json(products);
});

// User registration
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ username, password: hashedPassword });  
  res.status(201).send('User registered');
});

// User login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(user => user.username === username);
  if (!user) return res.status(400).send('User not found');

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).send('Invalid credentials');

  const token = jwt.sign({ username }, SECRET_KEY);
  res.json({ token });
});

// Sample endpoint
app.get('/', (req, res) => {
  res.send('E-commerce Marketplace API is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
