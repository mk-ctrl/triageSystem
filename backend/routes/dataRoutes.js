import express from 'express';
import { insertData } from '../controller/dataController.js';

const router = express.Router();

// POST route to receive data from frontend and insert into Supabase
router.post('/data', insertData);

export default router;
