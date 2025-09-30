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

// Routes
app.get('/api/test', (req, res) => {
  console.log("\n\n\n \t\t\t\t\t\t\t ----- Test endpoint hit -----\n\n".rainbow.italic.bgBlack);
  res.json({ status: 'OK', timestamp: new Date() });
});