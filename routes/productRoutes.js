import express from "express";
import {
  createProduct,
  getAllProducts,
  getProduct,
  updateProduct,
  deletedProduct,
  addToFav,
  getAllFav,
  removeFromFav
} from "../controllers/productController.js";
import { authenticateUser } from "../middlewares/auth.js";

const router = express.Router();

router.post("/create", createProduct);

router.post('/favorite', addToFav);
router.get('/favorite/:id', getAllFav);
router.delete('/favorite/:id', removeFromFav);

router.get("/", getAllProducts);
router.get("/:id", getProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deletedProduct);

export default router;
