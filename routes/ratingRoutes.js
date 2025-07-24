import express from "express";
import {
  rateProduct,
  getProductRatings,
  getUserRating,
  deleteRating,
  getRatingStats,
} from "../controllers/ratingController.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

/**
 * @route   POST /product/:id/rate
 * @desc    Rate a product (create or update rating)
 * @access  Private
 */
router.post("/product/:id/rate", protect, rateProduct);

/**
 * @route   GET /product/:id/ratings
 * @desc    Get all ratings for a product
 * @access  Public
 * @query   page, limit, sort (newest|oldest|highest|lowest)
 */
router.get("/product/:id/ratings", getProductRatings);

/**
 * @route   GET /product/:id/my-rating
 * @desc    Get current user's rating for a product
 * @access  Private
 */
router.get("/product/:id/my-rating", protect, getUserRating);

/**
 * @route   DELETE /product/:id/rate
 * @desc    Delete user's rating for a product
 * @access  Private
 */
router.delete("/product/:id/rate", protect, deleteRating);

/**
 * @route   GET /product/:id/rating-stats
 * @desc    Get rating statistics for a product
 * @access  Public
 */
router.get("/product/:id/rating-stats", getRatingStats);

export default router;
