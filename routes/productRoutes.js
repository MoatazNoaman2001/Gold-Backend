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
  requireApprovedAndPaidSeller,
  authorizeRoles,
} from "../middlewares/auth.js";
import { trackProductClick } from "../controllers/productController.js";
const router = express.Router();

router.post("/create", authenticateUser, requireApprovedAndPaidSeller, upload, createProduct);

router.post("/favorite/:productId", authenticateUser, toggleFavorite);
router.get("/favorite/:userId", authenticateUser, getAllFav);
router.delete("/favorite/:productId", authenticateUser, toggleFavorite);

router.get("/", getAllProducts);

router.get("/related", authenticateUser, getRelatedProducts);

router.get("/shop/:shopId",  getProductsByShop);

router.get("/:id",authenticateUser, getProduct);

router.put(
  "/:id",
  authenticateUser,
  requireApprovedAndPaidSeller,
  updateProduct
);

router.delete(
  "/:id",
  authenticateUser,
  requireApprovedAndPaidSeller,
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
