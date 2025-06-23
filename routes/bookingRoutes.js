import express from "express";
import { addAvailableTime } from "../controllers/bookingController.js";
import {protect} from "../middlewares/protect.js"
const router = express.Router();

router.post('/', protect, addAvailableTime);

export default router;
