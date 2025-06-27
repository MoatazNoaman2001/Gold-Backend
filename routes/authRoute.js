import express from "express";
import { login, register, googleAuthFailure, googleAuth } from "../controllers/authController.js";
import { authenticateGoogle, handleGoogleCallback } from "../middlewares/googleAuthMiddleWare.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

router.get('/google', authenticateGoogle);

router.get('/google/callback', handleGoogleCallback, googleAuth);

router.get('/google/failure', googleAuthFailure);
  

export default router;
