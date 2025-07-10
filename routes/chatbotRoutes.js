// routes/chatbotRoutes.js
import express from "express";
import { chatbot } from "../controllers/chatbotController.js";
import { authenticateUser } from "../middlewares/auth.js";
const router = express.Router();

router.post("/", authenticateUser, chatbot);
export default router;
