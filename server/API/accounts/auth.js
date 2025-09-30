import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Configure
dotenv.config();

// Route: /api/accounts/auth
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 10;

export default router;