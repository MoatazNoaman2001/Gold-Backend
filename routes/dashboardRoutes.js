import express from "express";
import {
  getUserStats,
  getUserActivity,
  getShopOwnerStats,
  getShopOwnerActivity,
  getUserBookings,
  cancelBooking,
  updateBooking,
} from "../controllers/dashboardController.js";
import { protect, restrictTo } from "../middlewares/auth.js";

const router = express.Router();

// Protect all routes
router.use(protect);

// User dashboard routes
router.get("/user/stats", getUserStats);
router.get("/user/activity", getUserActivity);
router.get("/user/bookings", getUserBookings);
router.patch("/user/bookings/:bookingId/cancel", cancelBooking);
router.patch("/user/bookings/:bookingId", updateBooking);

// Shop owner dashboard routes
router.get("/shop/stats", restrictTo("seller", "admin"), getShopOwnerStats);
router.get(
  "/shop/activity",
  restrictTo("seller", "admin"),
  getShopOwnerActivity
);

export default router;
