import express from "express";
import { createShop, getAllShops } from "../controllers/shopController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.post("/create", protect, createShop);
router.post("/", protect, getAllShops);

export default router;
