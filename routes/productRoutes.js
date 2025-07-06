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
} from "../controllers/productController.js";
import {
  authenticateUser,
  requireSeller,
  authorizeRoles,
} from "../middlewares/auth.js";

const router = express.Router();

// إنشاء منتج - للبائعين فقط
router.post("/create", authenticateUser, requireSeller, createProduct);

// إدارة المفضلة - للعملاء المسجلين
router.post("/favorite", authenticateUser, addToFav);
router.get("/favorite/:id", authenticateUser, getAllFav);
router.delete("/favorite/:id", authenticateUser, removeFromFav);

// عرض جميع المنتجات - للجميع
router.get("/", getAllProducts);

// عرض منتجات متجر معين - للجميع
router.get("/shop/:shopId", getProductsByShop);

// عرض منتج محدد - للجميع
router.get("/:id", getProduct);

// تحديث منتج - للبائعين والأدمن
router.put(
  "/:id",
  authenticateUser,
  authorizeRoles("seller", "admin"),
  updateProduct
);

// حذف منتج - للبائعين والأدمن
router.delete(
  "/:id",
  authenticateUser,
  authorizeRoles("seller", "admin"),
  deletedProduct
);

export default router;
