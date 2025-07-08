import express from "express";
import {
  createProduct,
  getAllProducts,
  getProduct,
  getProductsByShop,
  updateProduct,
  deletedProduct,
  addToFav,
  getAllFav,
  removeFromFav,
  regenerateDescription,
  generateDescriptionVariations,
  getRelatedProducts,
} from "../controllers/productController.js";
import {
  authenticateUser,
  requireSeller,
  authorizeRoles,
} from "../middlewares/auth.js";
import { trackProductClick } from "../controllers/productController.js";

const router = express.Router();

router.post("/create", authenticateUser, requireSeller, createProduct);

router.post("/favorite", authenticateUser, addToFav);
router.get("/favorite/:id", authenticateUser, getAllFav);
router.delete("/favorite/:id", authenticateUser, removeFromFav);

router.get("/", getAllProducts);

router.get("/related", authenticateUser, getRelatedProducts);

router.get("/shop/:shopId", getProductsByShop);

router.get("/:id", getProduct);

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
