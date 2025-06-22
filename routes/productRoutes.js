import express from "express";
import {
  createProduct,
  getAllProducts,
  getProduct,
  updateProduct,
  deletedProduct,
} from "../controllers/productController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.post("/create", createProduct);
router.get("/", getAllProducts);
router.get("/:id", getProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deletedProduct);

export default router;
