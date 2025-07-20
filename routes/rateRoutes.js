import express from "express";
import {
  createRate,
  getAllRates,
  getRate,
  updateRate,
  deleteRate,
} from "../controllers/rateController.js";
import { authenticateUser } from "../middlewares/auth.js";
const router = express.Router();

// Routes with specific paths first to avoid conflicts
router.get("/shop/:shopId", authenticateUser, getAllRates); // Get ratings for specific shop
router.get("/", authenticateUser, getAllRates); // Get all ratings for shop owner
router.post("/:shopId", authenticateUser, createRate);
router.get("/:id", authenticateUser, getRate);
router.put("/:id", authenticateUser, updateRate);
router.delete("/:id", authenticateUser, deleteRate);
export default router;
