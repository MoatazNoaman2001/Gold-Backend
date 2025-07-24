import express from "express";
import {
  createShop,
  getAllShops,
  getShop,
  updateShop,
  deleteShop,
  getPublicShops,
  getPublicShop,
  upload,
} from "../controllers/shopController.js";
import {
  authenticateUser,
  verifyShopOwnership,
  requireSeller,
  requireAdmin,
  authorizeRoles,
} from "../middlewares/auth.js";
import Shop from "../models/shopModel.js";
import User from "../models/userModel.js";
import NotificationService from "../services/notificationService.js";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
const router = express.Router();

// Public routes (no authentication required)
router.get("/public", getPublicShops);

router.get("/public/:id", getPublicShop);

router.post("/create", authenticateUser, requireSeller, upload, createShop);

router.get("/", authenticateUser, getAllShops);

router.get("/:id", authenticateUser, getShop);

router.put(
  "/:id",
  authenticateUser,
  authorizeRoles("seller", "admin"),
  updateShop
);

router.delete(
  "/:id",
  authenticateUser,
  authorizeRoles("seller", "admin"),
  deleteShop
);

router.patch(
  "/:id/approve",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      console.log(
        `Admin ${req.user.name} (${req.user.email}) attempting to approve shop ${req.params.id}`
      );

      const shop = await Shop.findByIdAndUpdate(
        req.params.id,
        {
          status: "approved",
          isApproved: true,
          approvedAt: new Date(),
          approvedBy: req.user._id,
        },
        { new: true }
      )
        .populate("owner", "name email")
        .populate("approvedBy", "name email");

      if (!shop) {
        console.log(`Shop with ID ${req.params.id} not found`);
        return res.status(404).json({ message: "Shop not found" });
      }

      console.log(`Shop ${shop.name} approved successfully`);

      // إرسال إشعار خاص لصاحب المتجر للتوجه لصفحة الدفع
      try {
        await NotificationService.createNotification({
          recipient: shop.owner._id,
          sender: req.user._id,
          type: "shop_approved_payment_required",
          title: "🎉 تم قبول متجرك - يتطلب الدفع",
          message: `تهانينا! تم قبول متجر "${shop.name}" من قبل الإدارة. يرجى إكمال عملية الدفع (5 دولار) لتفعيل المتجر ليصبح مرئياً للعملاء.`,
          data: {
            shopId: shop._id,
            shopName: shop.name,
            amount: 5,
            currency: "USD",
            paymentUrl: "/owner-payment",
            requiresPayment: true,
            approvedBy: req.user.name,
            approvedAt: new Date(),
          },
        });

        console.log(
          `📢 تم إرسال إشعار الدفع لصاحب المتجر: ${shop.owner.email}`
        );
      } catch (notificationError) {
        console.error("❌ فشل في إرسال إشعار الدفع:", notificationError);
      }

      res.json({
        status: "success",
        data: shop,
        message:
          "Shop approved successfully. Payment notification sent to shop owner.",
      });
    } catch (error) {
      console.error(`Error approving shop ${req.params.id}:`, error);
      res.status(500).json({ message: error.message });
    }
  }
);

router.patch(
  "/:id/reject",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const shop = await Shop.findByIdAndUpdate(
        req.params.id,
        { isApproved: false },
        { new: true }
      );
      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }
      res.json({ status: "success", data: shop });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Mark shop as paid (shop owner only)
// Route لعرض الـ PDF للأدمن
router.get(
  "/:id/commercial-record",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      console.log("🔍 PDF Request received:", {
        shopId: req.params.id,
        userId: req.user?._id,
        userRole: req.user?.role,
        userEmail: req.user?.email,
      });

      const shop = await Shop.findById(req.params.id);

      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }

      if (!shop.commercialRecord) {
        return res.status(404).json({ message: "Commercial record not found" });
      }

      const filePath = `uploads/commercial-records/${shop.commercialRecord}`;

      // التحقق من وجود الملف
      if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filePath}`);
        return res.status(404).json({
          message: "Commercial record file not found on server",
          filePath: filePath,
        });
      }

      // إرسال الملف
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${shop.name}-commercial-record.pdf"`
      );
      res.sendFile(path.resolve(filePath));
    } catch (error) {
      console.error("Error serving commercial record:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

router.patch("/:id/pay", authenticateUser, requireSeller, async (req, res) => {
  try {
    const shop = await Shop.findOne({
      _id: req.params.id,
      owner: req.user._id,
      status: "approved", // يجب أن يكون معتمد
    });

    if (!shop) {
      return res.status(404).json({
        message: "Shop not found or not approved yet",
      });
    }

    if (shop.status === "active") {
      return res.status(400).json({
        message: "Shop is already active and paid",
      });
    }

    // استخراج بيانات الدفع من الطلب
    const { paymentDetails } = req.body;

    const updatedShop = await Shop.findByIdAndUpdate(
      req.params.id,
      {
        status: "active",
        isPaid: true,
        paidAt: new Date(),
        paymentDetails: paymentDetails || {
          transactionId: `txn_${Date.now()}`,
          amount: 5,
          currency: "USD",
          paymentDate: new Date(),
        },
      },
      { new: true }
    );

    console.log(
      `💳 تم دفع رسوم المتجر: ${shop.name} - المالك: ${req.user.name}`
    );

    res.json({
      status: "success",
      data: updatedShop,
      message: "Shop payment completed successfully. Shop is now active!",
    });
  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
