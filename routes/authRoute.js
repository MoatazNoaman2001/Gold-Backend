import express from "express";
import { login, register, googleAuthFailure, googleAuth, refresh, logout, createPaymentSession, createCheckoutSession, createPortalSession, createReservationPaymentSession, stripeWebhook, sellerPaidUpdate, verifyReservationPayment, verifyReservationPaymentPublic, deleteReservation, getUserReservationsPublic } from "../controllers/authController.js";
import { authenticateGoogle, handleGoogleCallback } from "../middlewares/googleAuthMiddleWare.js";
import { authenticateUser, restrictTo } from "../middlewares/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get('/refresh', refresh);
router.get('/logout', logout);

router.get('/google', authenticateGoogle);
// router.get('/google/callback', handleGoogleCallback, googleAuth);
router.get('/google/failure', googleAuthFailure);
  
router.post('/google', googleAuth);
router.post('/create-payment-session', createPaymentSession);
router.post('/create-checkout-session', createCheckoutSession);
router.post('/create-portal-session', createPortalSession);
router.post('/create-reservation-payment-session', createReservationPaymentSession);
router.post('/verify-reservation-payment', authenticateUser, verifyReservationPayment);
router.post('/verify-reservation-payment-public', verifyReservationPaymentPublic);
router.get('/reservations-public', getUserReservationsPublic); // للاختبار فقط
router.delete('/reservation/:reservationId', authenticateUser, deleteReservation);
router.delete('/reservation-test/:reservationId', deleteReservation); // للاختبار فقط
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
router.post('/seller-paid-update', sellerPaidUpdate);

export default router;
