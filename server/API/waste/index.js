import express from 'express';

// Router Path ( /api/waste )
const router = express.Router();

import getRecord from './getRecord.js';
router.get('/records', getRecord);

import addRecord from './addRecord.js';
router.post('/add', addRecord); 

import analytics from './analytics.js';
router.get('/analytics', analytics);

import deleteToday from './deleteToday.js';
router.post('/delete-today', deleteToday);

export default router;