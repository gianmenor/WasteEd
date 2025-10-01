import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user exists and get current role from database
    const user = await prisma.account.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid token. User not found.' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

// GET /api/accounts/role - Check user role
router.get('/', verifyToken, async (req, res) => {
  try {
    return res.json({
      success: true,
      role: req.user.role,
      isAdmin: req.user.role === 'admin'
    });
  } catch (error) {
    console.error('Error checking user role:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to check user role' 
    });
  }
});

export default router;