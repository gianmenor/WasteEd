import express from 'express';

// Router Path ( /api )
const router = express.Router();

router.get('/', (req, res) => {
  console.log("\n\n\n \t\t\t\t\t\t\t ----- API Test endpoint hit -----\n\n".rainbow.italic.bgBlack);
  res.json({ status: 'API OK', timestamp: new Date() });
});

import healthRouter from './health.js';
router.use('/health', healthRouter);

import wasteRouter from './waste/index.js';
router.use('/waste', wasteRouter);

import authRouter from './accounts/auth.js';
router.use('/accounts', authRouter);

import manageRouter from './accounts/manage.js';
router.use('/accounts/manage', manageRouter);

import preferencesRouter from './accounts/preferences.js';
router.use('/accounts/preferences', preferencesRouter);

import roleRouter from './accounts/role.js';
router.use('/accounts/role', roleRouter);

import binRouter from './bin/index.js';
router.use('/bin', binRouter);

export default router;