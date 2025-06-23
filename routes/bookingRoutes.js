import express from "express";
import { addAvailableTime ,getAvailableTimesForShop} from "../controllers/bookingController.js";
import {protect} from "../middlewares/protect.js"
const router = express.Router();

router.post('/', protect, addAvailableTime);
router.get('/:shopId', protect, getAvailableTimesForShop);

export default router;
