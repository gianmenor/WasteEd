import express from 'express';

// Router Path ( /api/waste )
const router = express.Router();

import getRecord from './getRecord.js';
router.get('/records', getRecord);

import addRecord from './addRecord.js';
router.post('/add', addRecord); 


export default router;