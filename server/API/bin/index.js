import express from 'express';

// Route Path ( '/api/bin/' )
const router = express.Router();

// Import all bin-related routers
import addBinRecordRouter from './addBinRecord.js';
import getBinRecordsRouter from './getBinRecords.js';
import binAnalyticsRouter from './bin_analytics.js';
import notificationsRouter from './notifications.js';

// Register all routes
router.use('/full', addBinRecordRouter);           // POST /api/bin/full
router.use('/records', getBinRecordsRouter);       // GET /api/bin/records, /api/bin/records/latest
router.use('/analytics', binAnalyticsRouter);      // GET /api/bin/analytics/*
router.use('/notifications', notificationsRouter); // GET /api/bin/notifications/stream

export default router;