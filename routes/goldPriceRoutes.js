import express from 'express';
import { price_gram,calculateProductPrice} from '../controllers/goldPrice.js';
const router = express.Router();   


router.get('/price-gram/:karat', price_gram);

router.post('/calculate-product-price', calculateProductPrice);

export default router;