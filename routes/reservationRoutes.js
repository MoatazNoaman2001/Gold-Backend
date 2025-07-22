import express from 'express';
import { setupDIContainer } from '../Infrastructure/DI/Container.js';
import { authenticateUser, restrictTo } from '../middlewares/auth.js';

const router = express.Router();
const container = setupDIContainer();
const reservationController = container.resolve('reservationController');

// Apply authentication middleware to all routes
router.use(authenticateUser);

/**
 * @route   POST /api/reservations
 * @desc    Create a new reservation (10% payment)
 * @access  Private (Customer)
 */
router.post('/', reservationController.createReservation);

/**
 * @route   POST /api/reservations/:reservationId/confirm
 * @desc    Confirm reservation and pay remaining amount
 * @access  Private (Customer)
 */
router.post('/:reservationId/confirm', reservationController.confirmReservation);

/**
 * @route   DELETE /api/reservations/:reservationId
 * @desc    Cancel a reservation
 * @access  Private (Customer)
 */
router.delete('/:reservationId', reservationController.cancelReservation);

/**
 * @route   GET /api/reservations
 * @desc    Get user's reservations
 * @access  Private (Customer)
 */
router.get('/', reservationController.getUserReservations);

/**
 * @route   GET /api/reservations/:reservationId
 * @desc    Get reservation details
 * @access  Private (Customer)
 */
router.get('/:reservationId', reservationController.getReservationDetails);

// Shop-specific routes (for shop owners)
/**
 * @route   GET /api/reservations/shop/:shopId
 * @desc    Get shop's reservations
 * @access  Private (Shop Owner)
 */
router.get('/shop/:shopId', 
  restrictTo('shop_owner', 'admin'), 
  reservationController.getShopReservations
);

/**
 * @route   PATCH /api/reservations/:reservationId/status
 * @desc    Update reservation status (shop actions)
 * @access  Private (Shop Owner)
 */
router.patch('/:reservationId/status', 
  restrictTo('shop_owner', 'admin'), 
  reservationController.updateReservationStatus
);

export default router; 