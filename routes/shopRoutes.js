import express from "express";
import { createShop, getAllShops ,getShop ,updateShop , deleteShop} from "../controllers/shopController.js";
import { authenticateUser ,verifyShopOwnership} from "../middlewares/auth.js";
const router = express.Router();

router.post("/create", authenticateUser, createShop);
router.get("/", authenticateUser, getAllShops);
router.get("/:id", authenticateUser, getShop);
router.put("/:id", authenticateUser,verifyShopOwnership, updateShop);
router.delete("/:id", authenticateUser,verifyShopOwnership, deleteShop); 

export default router;
