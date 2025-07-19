import express from "express";
import {
  createProduct,
  getAllProducts,
  getProduct,
  getProductsByShop,
  updateProduct,
  deletedProduct,
  getAllFav,
  regenerateDescription,
  generateDescriptionVariations,
  getRelatedProducts,
  upload,
  toggleFavorite,
} from "../controllers/productController.js";
import {
  authenticateUser,
  requireSeller,
  authorizeRoles,
} from "../middlewares/auth.js";
import { trackProductClick } from "../controllers/productController.js";
import { updatePrices } from "../controllers/goldPrice.js";
const router = express.Router();

router.post("/create", authenticateUser, requireSeller, upload, createProduct);

router.post("/favorite/:productId", authenticateUser, toggleFavorite);
router.get("/favorite/:userId", authenticateUser, getAllFav);
router.delete("/favorite/:productId", authenticateUser, toggleFavorite);

router.get("/",updatePrices, getAllProducts);

router.get("/related", authenticateUser, getRelatedProducts);

router.get("/shop/:shopId",updatePrices,  getProductsByShop);

router.get("/:id",authenticateUser, getProduct);

router.put(
  "/:id",
  authenticateUser,
  authorizeRoles("seller", "admin"),
  updateProduct
);

router.delete(
  "/:id",
  authenticateUser,
  authorizeRoles("seller", "admin"),
  deletedProduct
);

router.get(
  "/generateDescriptionVariations/:productId",
  authenticateUser,
  generateDescriptionVariations
);
router.get(
  "/regenerate-description/:productId",
  authenticateUser,
  regenerateDescription
);

router.post("/track", authenticateUser, trackProductClick);

export default router;
