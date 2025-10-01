import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Configure
dotenv.config();
const prisma = new PrismaClient();

// Route: /api/accounts/
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 10;

// Setup login system with database
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Find user in database
    const user = await prisma.account.findFirst({
      where: {
        username: username
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Generate JWT token
    const tokenPayload = { 
      userId: user.id,
      username: user.username,
      name: user.username, // Using username as name since no separate name field
      role: user.role || 'user' // Use actual role from database
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Return token and user info
    return res.json({ 
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.username,
        role: user.role || 'user'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Token validation endpoint
router.get('/validate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    console.log('Validate - Auth header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Validate - No bearer token provided');
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    console.log('Validate - Token extracted:', token ? 'Present' : 'Missing');
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('Validate - Token decoded:', decoded);
      
      // Optionally verify user still exists in database
      const user = await prisma.account.findUnique({
        where: { id: decoded.userId }
      });

      console.log('Validate - User found:', user ? user.username : 'Not found');

      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      return res.json({ 
        valid: true, 
        user: {
          id: user.id,
          username: user.username,
          name: user.username,
          role: user.role || 'user'
        }
      });
    } catch (jwtError) {
      console.log('Validate - JWT error:', jwtError.message);
      return res.status(401).json({ message: 'Invalid token' });
    }
  } catch (error) {
    console.error('Validation error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Logout endpoint (optional - mainly for cleanup)
router.post('/logout', async (req, res) => {
  // In a real app, you might want to blacklist the token
  // For now, just return success
  return res.json({ message: 'Logged out successfully' });
});

// Cleanup on app termination
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default router;