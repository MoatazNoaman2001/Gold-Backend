import express from "express";
import {
  updateUser,
  deleteUser,
  resetPassword,
  forgotPassword,
  resetPasswordWithToken,
  getUser,
  updateRole,
} from "../controllers/userController.js";
import {
  authenticateUser,
  requireAdmin,
  authorizeRoles,
} from "../middlewares/auth.js";
import User from "../models/userModel.js";
const router = express.Router();

router.put("/", authenticateUser, updateUser);
router.delete("/", authenticateUser, deleteUser);
router.post("/reset_password", authenticateUser, resetPassword);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPasswordWithToken);
router.get("/me", authenticateUser, getUser);


router.patch("/role", authenticateUser, requireAdmin, updateRole);

router.get("/all", authenticateUser, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password -refreshToken");
    res.json({ status: "success", data: users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/role/:role", authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { role } = req.params;
    const users = await User.find({ role }).select("-password -refreshToken");
    res.json({ status: "success", data: users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
