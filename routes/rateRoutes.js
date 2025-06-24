import express from 'express';
import { createRate, getAllRates, getRate, updateRate, deleteRate } from '../controllers/rateController.js';
import { protect } from '../middlewares/protect.js';        


const router = express.Router();    
router.post('/:shopId', protect, createRate);
router.get('/', protect, getAllRates);
router.get('/:id', protect, getRate);
router.put('/:id', protect, updateRate);
router.delete('/:id', protect, deleteRate); 
export default router;