import express from 'express';

// Router Path ( /api )
const router = express.Router();

router.get('/', (req, res) => {
  console.log("\n\n\n \t\t\t\t\t\t\t ----- API Test endpoint hit -----\n\n".rainbow.italic.bgBlack);
  res.json({ status: 'API OK', timestamp: new Date() });
});


import wasteRouter from './waste/index.js';
router.use('/waste', wasteRouter);

import authRouter from './accounts/auth.js';
router.use('/accounts', authRouter);

export default router;