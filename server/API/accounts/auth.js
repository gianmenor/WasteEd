import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { prisma } from '../../utils/database.js';

// Configure
dotenv.config();

// Route: /api/accounts/
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 10;
const DEFAULT_FORGOT_CODE = '1234';
const DEFAULT_FORGOT_EMAIL = 'wasteed277@gmail.com';

const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.account.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid token. User not found.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
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

const createMailerTransport = () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
};

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
        email: user.email,
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
          email: user.email,
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

// Forgot password flow: requires username, a 4-digit recovery code, and a new password.
router.post('/forgot-password', async (req, res) => {
  try {
    const { username, recoveryCode, newPassword } = req.body;

    if (!username || !recoveryCode || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Username, recovery code, and new password are required'
      });
    }

    if (!/^\d{4}$/.test(String(recoveryCode))) {
      return res.status(400).json({
        success: false,
        message: 'Recovery code must be exactly 4 digits'
      });
    }

    if (String(newPassword).length < 3) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 3 characters'
      });
    }

    const expectedCode = process.env.FORGOT_PASSWORD_CODE || DEFAULT_FORGOT_CODE;
    if (String(recoveryCode) !== String(expectedCode)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid recovery code'
      });
    }

    const user = await prisma.account.findFirst({
      where: { username }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.account.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    const recipient = process.env.FORGOT_PASSWORD_TO || DEFAULT_FORGOT_EMAIL;
    const sender = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;
    const transporter = createMailerTransport();

    if (!transporter || !sender) {
      console.error('Forgot password email not sent: SMTP config is missing.');
      return res.status(500).json({
        success: false,
        message: 'Password changed, but email notification could not be sent. Configure SMTP settings.'
      });
    }

    await transporter.sendMail({
      from: sender,
      to: recipient,
      subject: '[Waste-Ed] Password Reset Notification',
      text: `Password reset completed for username: ${username}\nTime: ${new Date().toISOString()}`,
      html: `<p>Password reset completed for username: <strong>${username}</strong></p><p>Time: ${new Date().toISOString()}</p>`
    });

    return res.json({
      success: true,
      message: 'Password reset successful. Notification email sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process forgot password request'
    });
  }
});

// Developer/admin-only utility to clear waste and coupon activity data.
router.post('/dev/clear-data', verifyAdmin, async (req, res) => {
  try {
    const { confirmationText } = req.body;

    if (confirmationText !== 'CLEAR ALL DATA') {
      return res.status(400).json({
        success: false,
        message: 'Confirmation text does not match.'
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const wasteDeleted = await tx.waste_items.deleteMany({});
      const couponTransactionsDeleted = await tx.couponTransaction.deleteMany({});
      const couponReset = await tx.coupon.updateMany({
        data: {
          balance: 0,
          used: 0
        }
      });

      return {
        wasteDeleted: wasteDeleted.count,
        couponTransactionsDeleted: couponTransactionsDeleted.count,
        couponsReset: couponReset.count
      };
    });

    return res.json({
      success: true,
      message: 'Waste and coupon data cleared successfully.',
      data: result
    });
  } catch (error) {
    console.error('Clear data error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear data.'
    });
  }
});

export default router;