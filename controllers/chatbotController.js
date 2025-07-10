// controllers/chatbotController.js
import { getChatbotResponse } from "../services/aiChatbotService.js";
import { catchAsync } from "../utils/wrapperFunction.js";

export const chatbot = catchAsync(async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  const aiResponse = await getChatbotResponse(message, req.user);
  res.json({ response: aiResponse });
});
