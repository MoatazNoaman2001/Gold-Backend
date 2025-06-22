import express from "express";
import { createShop, getAllShops ,getShop ,updateShop , deleteShop} from "../controllers/shopController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.post("/create", protect, createShop);
router.get("/", protect, getAllShops);
router.get("/:id", protect, getShop);
router.put("/:id", protect, updateShop);
router.delete("/:id", protect, deleteShop); 

export default router;
