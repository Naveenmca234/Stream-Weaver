import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';

function signAccess(payload: object): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

function signRefresh(payload: object): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: role || 'analyst',
    });

    const payload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);

    await User.findByIdAndUpdate(user._id, {
      $push: { refreshTokens: refreshToken },
      lastLoginAt: new Date(),
    });

    res.status(201).json({
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password +refreshTokens'
    );

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const payload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);

    await User.findByIdAndUpdate(user._id, {
      $push: { refreshTokens: refreshToken },
      lastLoginAt: new Date(),
    });

    res.json({
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    const decoded = jwt.verify(token, config.jwt.refreshSecret) as {
      id: string;
      email: string;
      role: string;
      name: string;
    };

    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user || !user.refreshTokens?.includes(token)) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const payload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = signAccess(payload);
    const newRefreshToken = signRefresh(payload);

    // Rotate refresh token
    await User.findByIdAndUpdate(user._id, {
      $pull: { refreshTokens: token },
      $push: { refreshTokens: newRefreshToken },
    });

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}

export async function logout(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { refreshToken: token } = req.body;
    if (token && req.user?.id) {
      await User.findByIdAndUpdate(req.user.id, {
        $pull: { refreshTokens: token },
      });
    }
    res.json({ message: 'Logged out successfully' });
  } catch {
    res.json({ message: 'Logged out' });
  }
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}
