import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { PrismaClient } from '../../generated/prisma/index.js';

// Configure
dotenv.config();
const prisma = new PrismaClient();

// Route: /api/accounts/manage
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const SALT_ROUNDS = 10;

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user exists
    const user = await prisma.account.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid token. User not found.' });
    }

    req.user = {
      id: user.id,
      username: user.username
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

// GET /api/accounts/manage/list - Get all accounts
router.get('/list', verifyToken, async (req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      select: {
        id: true,
        username: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Add role information (since it's not in the database, we'll use a default)
    const accountsWithRole = accounts.map(account => ({
      ...account,
      role: account.username === 'admin' ? 'Administrator' : 'User',
      active: true // Default to active since we don't have an active field
    }));

    return res.json({
      success: true,
      accounts: accountsWithRole
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch accounts' 
    });
  }
});

// POST /api/accounts/manage/create - Create new account
router.post('/create', verifyToken, async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }

    if (username.length < 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username must be at least 3 characters long' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters long' 
      });
    }

    // Check if username already exists
    const existingUser = await prisma.account.findUnique({
      where: { username }
    });

    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'Username already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create new account
    const newAccount = await prisma.account.create({
      data: {
        username,
        password: hashedPassword
      },
      select: {
        id: true,
        username: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Add role information
    const accountWithRole = {
      ...newAccount,
      role: role || 'User',
      active: true
    };

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      account: accountWithRole
    });
  } catch (error) {
    console.error('Error creating account:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create account' 
    });
  }
});

// DELETE /api/accounts/manage/:id - Delete account
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const currentUserId = req.user.id;

    // Validate account ID
    if (isNaN(accountId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid account ID' 
      });
    }

    // Check if account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({ 
        success: false, 
        message: 'Account not found' 
      });
    }

    // Prevent users from deleting their own account
    if (accountId === currentUserId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Cannot delete your own account' 
      });
    }

    // Check if this is the last account
    const accountCount = await prisma.account.count();
    if (accountCount <= 1) {
      return res.status(403).json({ 
        success: false, 
        message: 'Cannot delete the last account in the system' 
      });
    }

    // Delete the account
    await prisma.account.delete({
      where: { id: accountId }
    });

    return res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to delete account' 
    });
  }
});

// PUT /api/accounts/manage/:id - Update account
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const { username, password } = req.body;

    // Validate account ID
    if (isNaN(accountId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid account ID' 
      });
    }

    // Check if account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({ 
        success: false, 
        message: 'Account not found' 
      });
    }

    // Prepare update data
    const updateData = {};

    if (username) {
      if (username.length < 3) {
        return res.status(400).json({ 
          success: false, 
          message: 'Username must be at least 3 characters long' 
        });
      }

      // Check if new username already exists (excluding current account)
      const existingUser = await prisma.account.findFirst({
        where: { 
          username,
          id: { not: accountId }
        }
      });

      if (existingUser) {
        return res.status(409).json({ 
          success: false, 
          message: 'Username already exists' 
        });
      }

      updateData.username = username;
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ 
          success: false, 
          message: 'Password must be at least 6 characters long' 
        });
      }

      updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
    }

    // Update account
    const updatedAccount = await prisma.account.update({
      where: { id: accountId },
      data: updateData,
      select: {
        id: true,
        username: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Add role information
    const accountWithRole = {
      ...updatedAccount,
      role: updatedAccount.username === 'admin' ? 'Administrator' : 'User',
      active: true
    };

    return res.json({
      success: true,
      message: 'Account updated successfully',
      account: accountWithRole
    });
  } catch (error) {
    console.error('Error updating account:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to update account' 
    });
  }
});

// Cleanup on app termination
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default router;