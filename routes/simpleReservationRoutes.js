import express from 'express';
import { authenticateUser, restrictTo } from '../middlewares/auth.js';
import {
  createSimpleReservation,
  getUserSimpleReservations,
  cancelSimpleReservation,
  confirmSimpleReservation,
  getSimpleReservationDetails,
  getShopSimpleReservations,
  updateSimpleReservationStatus
} from '../controllers/simpleReservationController.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

/**
 * @route   POST /api/simple-reservations
 * @desc    Create a new reservation (10% payment)
 * @access  Private (Customer)
 */
router.post('/', createSimpleReservation);

/**
 * @route   POST /api/simple-reservations/process-payment
 * @desc    Process payment for reservation
 * @access  Private (Customer)
 */
router.post('/process-payment', createSimpleReservation);

/**
 * @route   GET /api/simple-reservations
 * @desc    Get user's reservations
 * @access  Private (Customer)
 */
router.get('/', getUserSimpleReservations);

/**
 * @route   GET /api/simple-reservations/:reservationId
 * @desc    Get reservation details
 * @access  Private (Customer)
 */
router.get('/:reservationId', getSimpleReservationDetails);

/**
 * @route   POST /api/simple-reservations/:reservationId/confirm
 * @desc    Confirm reservation and pay remaining amount
 * @access  Private (Customer)
 */
router.post('/:reservationId/confirm', confirmSimpleReservation);

/**
 * @route   DELETE /api/simple-reservations/:reservationId
 * @desc    Cancel a reservation
 * @access  Private (Customer)
 */
router.delete('/:reservationId', cancelSimpleReservation);

/**
 * @route   GET /api/simple-reservations/shop/:shopId
 * @desc    Get shop's reservations
 * @access  Private (Shop Owner)
 */
router.get('/shop/:shopId',
  restrictTo('shop_owner', 'admin'),
  getShopSimpleReservations
);

/**
 * @route   PATCH /api/simple-reservations/:reservationId/status
 * @desc    Update reservation status (shop actions)
 * @access  Private (Shop Owner)
 */
router.patch('/:reservationId/status',
  restrictTo('shop_owner', 'admin'),
  updateSimpleReservationStatus
);

export default router;
