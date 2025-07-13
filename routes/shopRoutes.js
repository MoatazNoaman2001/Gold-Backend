import express from "express";
import {
  createShop,
  getAllShops,
  getShop,
  updateShop,
  deleteShop,
  getPublicShops,
  getPublicShop,
  upload,
} from "../controllers/shopController.js";
import {
  authenticateUser,
  verifyShopOwnership,
  requireSeller,
  requireAdmin,
  authorizeRoles,
} from "../middlewares/auth.js";
import Shop from "../models/shopModel.js";
const router = express.Router();

// Public routes (no authentication required)
router.get("/public", getPublicShops);

router.get("/public/:id", getPublicShop);

router.post("/create", authenticateUser, requireSeller, upload, createShop);

router.get("/", authenticateUser, getAllShops);

router.get("/:id", authenticateUser, getShop);

router.put(
  "/:id",
  authenticateUser,
  authorizeRoles("seller", "admin"),
  updateShop
);

router.delete(
  "/:id",
  authenticateUser,
  authorizeRoles("seller", "admin"),
  deleteShop
);


router.patch(
  "/:id/approve",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      console.log(
        `Admin ${req.user.name} (${req.user.email}) attempting to approve shop ${req.params.id}`
      );

      const shop = await Shop.findByIdAndUpdate(
        req.params.id,
        { isApproved: true },
        { new: true }
      );

      if (!shop) {
        console.log(`Shop with ID ${req.params.id} not found`);
        return res.status(404).json({ message: "Shop not found" });
      }

      console.log(`Shop ${shop.name} approved successfully`);
      res.json({ status: "success", data: shop });
    } catch (error) {
      console.error(`Error approving shop ${req.params.id}:`, error);
      res.status(500).json({ message: error.message });
    }
  }
);

router.patch(
  "/:id/reject",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const shop = await Shop.findByIdAndUpdate(
        req.params.id,
        { isApproved: false },
        { new: true }
      );
      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }
      res.json({ status: "success", data: shop });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

export default router;
