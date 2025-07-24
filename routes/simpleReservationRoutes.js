import express from "express";
import {
  createReservation,
  getUserReservations,
  getShopReservations,
  confirmReservation,
  cancelReservation,
  updateReservationStatus,
  processPayment,
} from "../controllers/simpleReservationController.js";
import { authenticateUser, requireSeller } from "../middlewares/auth.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

/**
 * @route   POST /api/simple-reservations/process-payment
 * @desc    Process payment for reservation
 * @access  Private (Customer)
 */
router.post("/process-payment", processPayment);

/**
 * @route   POST /api/simple-reservations
 * @desc    Create a new reservation (10% payment)
 * @access  Private (Customer)
 */
router.post("/", createReservation);

/**
 * @route   GET /api/simple-reservations
 * @desc    Get user's reservations
 * @access  Private (Customer)
 */
router.get("/", getUserReservations);

/**
 * @route   POST /api/simple-reservations/:reservationId/confirm
 * @desc    Confirm reservation and pay remaining amount
 * @access  Private (Customer)
 */
router.post("/:reservationId/confirm", confirmReservation);

/**
 * @route   DELETE /api/simple-reservations/:reservationId
 * @desc    Cancel a reservation
 * @access  Private (Customer)
 */
router.delete("/:reservationId", cancelReservation);

/**
 * @route   GET /api/simple-reservations/shop/:shopId
 * @desc    Get shop's reservations
 * @access  Private (Shop Owner)
 */
router.get("/shop/:shopId", getShopReservations);

/**
 * @route   PATCH /api/simple-reservations/:reservationId/status
 * @desc    Update reservation status (shop actions)
 * @access  Private (Shop Owner)
 */
router.patch("/:reservationId/status", updateReservationStatus);

export default router;
