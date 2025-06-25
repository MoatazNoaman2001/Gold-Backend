import express from 'express';
import { createRate, getAllRates, getRate, updateRate, deleteRate } from '../controllers/rateController.js';
import { authenticateUser } from '../middlewares/auth.js';
const router = express.Router();   


router.post('/:shopId', authenticateUser, createRate);
router.get('/', authenticateUser, getAllRates);
router.get('/:id', authenticateUser, getRate);
router.put('/:id', authenticateUser, updateRate);
router.delete('/:id', authenticateUser, deleteRate); 
export default router;