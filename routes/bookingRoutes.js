import express from "express";
import {
  addAvailableTime,
  getAvailableTimesForShop,
  bookTime,
} from "../controllers/bookingController.js";
 import { authenticateUser } from "../middlewares/auth.js";  

const router = express.Router();

router.post("/", authenticateUser, addAvailableTime);
router.get("/:shopId", authenticateUser, getAvailableTimesForShop);
router.post("/book", authenticateUser, bookTime);

export default router;
