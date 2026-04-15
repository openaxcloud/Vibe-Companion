import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { authenticateToken, authorizeAdmin } from '../middleware/auth';

const router = Router();

// Register a new user
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
      [username, email, hashedPassword, 'user']
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
    res.status(201).json({ success: true, data: user, token });
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation code
      return res.status(409).json({ success: false, message: 'User with this email already exists.' });
    }
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password.' });
  }

  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
    const { password: _, ...userData } = user; // Exclude password from response
    res.status(200).json({ success: true, data: userData, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Get all users (Admin only)
router.get('/users', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const result = await query('SELECT id, username, email, role FROM users');
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching users.' });
  }
});

export default router;