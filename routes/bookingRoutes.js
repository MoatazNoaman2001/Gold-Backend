import express from "express";
import {
  addAvailableTime,
  getAvailableTimesForShop,
  bookTime,
  getShopBookings,
  getUserBookings,
  cancelBooking,
  deleteAvailableTime,
} from "../controllers/bookingController.js";
import { authenticateUser, requireSeller } from "../middlewares/auth.js";

const router = express.Router();

// Shop owner routes (require seller role)
router.post(
  "/available-time",
  authenticateUser,
  requireSeller,
  addAvailableTime
);
router.get("/shop/bookings", authenticateUser, requireSeller, getShopBookings);
router.delete(
  "/available-time/:timeId",
  authenticateUser,
  requireSeller,
  deleteAvailableTime
);

// Customer routes
router.get("/available/:shopId", getAvailableTimesForShop); // Public route
router.post("/book", authenticateUser, bookTime);
router.get("/my-bookings", authenticateUser, getUserBookings);
router.delete("/cancel/:timeId", authenticateUser, cancelBooking);

// Legacy routes (for backward compatibility)
router.post("/", authenticateUser, addAvailableTime);
router.get("/:shopId", getAvailableTimesForShop);

export default router;
