import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import colors from 'colors';

// Configure
dotenv.config();
colors.enable();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Start server
app.listen(PORT, () => {
  console.log(`\n\nLINK: `.cyan + `http://localhost:${PORT}/`.italic.underline.yellow);
});

// API
import APIRouter from './API/index.js';
app.use('/api', APIRouter);

// SPA Fallback - Serve React app for all non-API routes
app.use((req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Serve React app's index.html for all other routes
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 Handler (this will only catch routes that somehow bypass the above)
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
}); 