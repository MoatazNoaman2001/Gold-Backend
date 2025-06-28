import express from "express";
import { login, register, googleAuthFailure, googleAuth, refresh, logout } from "../controllers/authController.js";
import { authenticateGoogle, handleGoogleCallback } from "../middlewares/googleAuthMiddleWare.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get('/refresh', refresh);
router.get('/logout', logout);

router.get('/google', authenticateGoogle);
router.get('/google/callback', handleGoogleCallback, googleAuth);
router.get('/google/failure', googleAuthFailure);
  

export default router;
