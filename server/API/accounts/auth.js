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
const DEFAULT_FORGOT_EMAIL = 'wasteed277@gmail.com';
const FORGOT_OTP_EXPIRY_MS = 10 * 60 * 1000;

let forgotPasswordOtpState = null;

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

const generateSixDigitOtp = () => String(Math.floor(100000 + Math.random() * 900000));

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

// Step 1: Send OTP to configured recipient email.
router.post('/forgot-password/request-otp', async (req, res) => {
  try {
    const user = await prisma.account.findFirst({
      orderBy: { id: 'asc' }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    const recipient = process.env.FORGOT_PASSWORD_TO || DEFAULT_FORGOT_EMAIL || user.email;
    const sender = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;
    const transporter = createMailerTransport();

    if (!transporter || !sender) {
      console.error('Forgot password OTP not sent: SMTP config is missing.');
      return res.status(500).json({
        success: false,
        message: 'Cannot send OTP because SMTP is not configured.'
      });
    }

    const otp = generateSixDigitOtp();
    const expiresAt = Date.now() + FORGOT_OTP_EXPIRY_MS;

    forgotPasswordOtpState = {
      otp,
      expiresAt,
      userId: user.id
    };

    await transporter.sendMail({
      from: sender,
      to: recipient,
      subject: '[Waste-Ed] Your Password Reset OTP',
      text: `Waste-Ed Password Reset\n\nOTP: ${otp}\nValid for: 10 minutes\n\nIf you did not request this, please ignore this email.`,
      html: `
        <div style="margin:0;padding:24px;background:#f4f7fb;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background:linear-gradient(90deg,#047857,#0f766e);padding:22px 26px;color:#ffffff;">
                <div style="font-size:20px;font-weight:700;letter-spacing:.2px;">Waste-Ed Security</div>
                <div style="opacity:.9;font-size:13px;margin-top:4px;">Password Reset Verification</div>
              </td>
            </tr>
            <tr>
              <td style="padding:26px;">
                <p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;color:#334155;">A password reset request was made for your account. Use the one-time password below to continue:</p>
                <div style="margin:18px 0 16px 0;text-align:center;">
                  <span style="display:inline-block;padding:14px 24px;border-radius:10px;background:#ecfeff;border:1px solid #99f6e4;font-size:28px;letter-spacing:6px;font-weight:700;color:#0f766e;">${otp}</span>
                </div>
                <p style="margin:0 0 10px 0;font-size:14px;color:#475569;">This OTP is valid for <strong>10 minutes</strong>.</p>
                <p style="margin:0;font-size:14px;color:#64748b;">If you did not request this reset, you can safely ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 26px;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:12px;color:#64748b;">
                This is an automated security email from Waste-Ed. Please do not reply.
              </td>
            </tr>
          </table>
        </div>
      `
    });

    return res.json({
      success: true,
      message: `OTP sent to ${recipient}.`
    });
  } catch (error) {
    console.error('Forgot password OTP request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
});

// Step 2: Verify OTP and update password.
router.post('/forgot-password/verify-otp', async (req, res) => {
  try {
    const { otp, newPassword } = req.body;

    if (!otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'OTP and new password are required'
      });
    }

    if (!/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({
        success: false,
        message: 'OTP must be exactly 6 digits'
      });
    }

    if (String(newPassword).length < 3) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 3 characters'
      });
    }

    if (!forgotPasswordOtpState) {
      return res.status(400).json({
        success: false,
        message: 'No OTP request found. Please request an OTP first.'
      });
    }

    if (Date.now() > forgotPasswordOtpState.expiresAt) {
      forgotPasswordOtpState = null;
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.'
      });
    }

    if (String(otp) !== forgotPasswordOtpState.otp) {
      return res.status(401).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    const user = await prisma.account.findUnique({
      where: { id: forgotPasswordOtpState.userId }
    });

    if (!user) {
      forgotPasswordOtpState = null;
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), SALT_ROUNDS);

    await prisma.account.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    forgotPasswordOtpState = null;

    return res.json({
      success: true,
      message: 'Password reset successful.'
    });
  } catch (error) {
    console.error('Forgot password OTP verify error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP'
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
