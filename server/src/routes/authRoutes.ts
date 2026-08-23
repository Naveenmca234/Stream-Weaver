import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../storage/sqlite/database';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting: 10 requests per 5 minutes for auth endpoints
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { message: 'Too many requests from this IP, please try again after 5 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authLimiter);

const isEmailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isEmailAllowed = (email: string) => {
  if (!isEmailValid(email)) return false;
  
  const envDomains = process.env.ALLOWED_DOMAINS;
  if (!envDomains || envDomains.trim() === '') {
    return true; // If not configured, allow all
  }

  const allowedDomains = envDomains.split(',').map(d => d.trim().toLowerCase());
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1].toLowerCase();
  
  return allowedDomains.some((d) => domain === d || domain.endsWith('.' + d));
};

const isPasswordStrong = (password: string) => {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false; // At least one uppercase
  if (!/[0-9]/.test(password)) return false; // At least one number
  return true;
};

const createToken = (user: { id: string; role: string; email: string }) => {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production.');
  }
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email }, 
    secret || 'devsecret', 
    { expiresIn: '7d' }
  );
};

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Name is required.' });
    }
    if (!isEmailValid(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }
    if (!isEmailAllowed(email)) {
      return res.status(403).json({ message: 'Email domain is not allowed.' });
    }
    if (!isPasswordStrong(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter and one number.' });
    }

    const stmtCheck = db.prepare('SELECT id FROM users WHERE email = ?');
    const existing = stmtCheck.get(email);
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const userId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const stmtInsert = db.prepare(`
      INSERT INTO users (id, email, password_hash, role) 
      VALUES (?, ?, ?, ?)
    `);
    
    // Hardcode user name outside the db for now if we didn't migrate a name column, 
    // or just omit name from DB since the prompt schema only has email/password.
    // Assuming schema from Phase 3: id, email, password_hash, role, created_at
    stmtInsert.run(userId, email, hashed, 'USER');

    const user = { id: userId, email, role: 'USER', name };
    const token = createToken(user);
    
    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Registration failed:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!isEmailValid(email) || !isEmailAllowed(email) || typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const stmtFind = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmtFind.get(email) as any;

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const authUser = { id: user.id, email: user.email, role: user.role, name: 'User' };
    const token = createToken(authUser);

    res.json({ token, user: authUser });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

export default router;
