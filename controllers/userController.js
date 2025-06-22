import { catchAsync } from "../utils/wrapperFunction.js";
import userModel from "../models/userModel.js";
import jwt from "jsonwebtoken";
import sendEmail from "../utils/sendEmail.js";

export const getUser = catchAsync(async (req, res) => {
    const user = await userModel.findById(req.user._id).select("-password");
    if (!user) {
        return res.status(404).json({
            status: "fail",
            message: "User not found",
        });
    }
    res.status(200).json({
        status: "success",
        data: user,
    });
});

export const updateUser = catchAsync(async (req, res) => {
    const { name, email, phone } = req.body;

    // Validate input
    if (!name || !email || !phone) {
        return res.status(400).json({
            status: "fail",
            message: "Name, email, and phone are required",
        });
    }

    // Update user information
    const updatedUser = await userModel.findByIdAndUpdate(
        req.user._id,
        { name, email, phone },
        { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
        return res.status(404).json({
            status: "fail",
            message: "User not found",
        });
    }

    res.status(200).json({
        status: "success",
        data: updatedUser,
    });
});

export const deleteUser = catchAsync(async (req, res) => {
    const user = await userModel.findByIdAndDelete(req.user._id);
    if (!user) {
        return res.status(404).json({
            status: "fail",
            message: "User not found",
        });
    }

    res.status(204).json({
        status: "success",
        message: "User deleted successfully",
    });
});
export const resetPassword = catchAsync(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    // Validate input
    if (!oldPassword || !newPassword) {
        return res.status(400).json({
            status: "fail",
            message: "Old password and new password are required",
        });
    }

    const user = await userModel.findById(req.user._id).select("+password");
    if (!user || !(await user.comparePassword(oldPassword))) {
        return res.status(401).json({
            status: "fail",
            message: "Incorrect old password",
        });
    }

    user.password = newPassword;
    await user.save();

    sendToken(user, 200, res);
});
export const forgotPassword = catchAsync(async (req, res) => {
    const { email } = req.body;

    try {
        const user = await userModel.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const resetToken = jwt.sign({ id: user._id, email: user.email, UserType: user.UserType }, process.env.JWT_SECRET, { expiresIn: "1h" });

        await user.save();

        const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;
        const message = `Click to reset your password: ${resetUrl}`;

        await sendEmail({
            to: user.email,
            subject: 'Password Reset',
            text: message,
        });

        res.json({ message: 'Reset email sent' });
    } catch (err) {
        console.error('Error during forgot-password:', err);
        res.status(500).json({ message: 'Error sending reset email' });
    }
});

export const resetPasswordWithToken = catchAsync(async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded.id).select("+password");

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.password = newPassword;
        await user.save();
        res.json({ message: 'Password reset successfully' });
        //sendToken(user, 200, res);
    } catch (err) {
        console.error('Error during reset-password with token:', err);
        res.status(500).json({ message: 'Error resetting password' });
    }
});
