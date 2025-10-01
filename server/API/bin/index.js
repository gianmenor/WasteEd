import express from 'express';

// Route Path ( '/api/bin/' )
const router = express.Router();

import binRouter from './bin.js';
router.use('/full', binRouter);

export default router;