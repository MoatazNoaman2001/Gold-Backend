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
  generateShopQRCode,
  getShopQRCode,
} from "../controllers/shopController.js";
import {
  authenticateUser,
  verifyShopOwnership,
  requireSeller,
  requireAdmin,
  requirePaidSeller,
  requireApprovedShop,
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
          isApproved: true,
          requestStatus: "approved" // تحديث requestStatus أيضاً
        },
        { new: true }
      ).populate("owner", "name email");

      if (!shop) {
        console.log(`Shop with ID ${req.params.id} not found`);
        return res.status(404).json({ message: "Shop not found" });
      }

      console.log(`Shop ${shop.name} approved successfully`);

      // إرسال إشعار فوري لصاحب المتجر عبر WebSocket
      try {
        const { getChatIO } = await import('../sockets/socketService.js');
        const io = getChatIO();

        // إرسال إشعار لصاحب المتجر
        io.to(shop.owner._id.toString()).emit('shopApproved', {
          shopId: shop._id,
          shopName: shop.name,
          message: 'تم الموافقة على متجرك! يمكنك الآن المتابعة لعملية الدفع.',
          timestamp: new Date()
        });

        console.log(`Notification sent to shop owner ${shop.owner.email}`);
      } catch (socketError) {
        console.error('Error sending socket notification:', socketError);
        // لا نفشل العملية إذا فشل الإشعار
      }

      res.json({ status: "success", data: shop });
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
        { isApproved: false, requestStatus: "rejected" },
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

// طلب تفعيل المتجر من صاحب المتجر
router.patch(
  "/:id/request-activation",
  authenticateUser,
  requireSeller,
  async (req, res) => {
    try {
      const shop = await Shop.findOne({
        _id: req.params.id,
        owner: req.user._id
      });

      if (!shop) {
        return res.status(404).json({
          status: "fail",
          message: "Shop not found or you don't own this shop"
        });
      }

      if (shop.requestStatus === "approved") {
        return res.status(400).json({
          status: "fail",
          message: "Shop is already approved"
        });
      }

      if (shop.requestStatus === "pending") {
        return res.status(400).json({
          status: "fail",
          message: "Activation request is already pending"
        });
      }

      const updatedShop = await Shop.findByIdAndUpdate(
        req.params.id,
        { requestStatus: "pending" },
        { new: true }
      );

      res.json({
        status: "success",
        message: "Activation request submitted successfully",
        data: updatedShop
      });
    } catch (error) {
      console.error(`Error requesting shop activation:`, error);
      res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  }
);

// موافقة الأدمن على طلب تفعيل المتجر
router.patch(
  "/:id/approve-activation",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const shop = await Shop.findByIdAndUpdate(
        req.params.id,
        {
          requestStatus: "approved",
          isApproved: true
        },
        { new: true }
      ).populate("owner", "name email");

      if (!shop) {
        return res.status(404).json({
          status: "fail",
          message: "Shop not found"
        });
      }

      console.log(`Admin ${req.user.name} approved shop activation for ${shop.name}`);

      // إرسال إشعار فوري لصاحب المتجر عبر WebSocket
      try {
        const { getChatIO } = await import('../sockets/socketService.js');
        const io = getChatIO();

        // إرسال إشعار لصاحب المتجر
        io.to(shop.owner._id.toString()).emit('shopApproved', {
          shopId: shop._id,
          shopName: shop.name,
          message: 'تم الموافقة على متجرك! يمكنك الآن المتابعة لعملية الدفع.',
          timestamp: new Date()
        });

        console.log(`Notification sent to shop owner ${shop.owner.email}`);
      } catch (socketError) {
        console.error('Error sending socket notification:', socketError);
        // لا نفشل العملية إذا فشل الإشعار
      }

      res.json({
        status: "success",
        message: "Shop activation approved successfully",
        data: shop
      });
    } catch (error) {
      console.error(`Error approving shop activation:`, error);
      res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  }
);

// رفض الأدمن لطلب تفعيل المتجر
router.patch(
  "/:id/reject-activation",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const { reason } = req.body;

      const shop = await Shop.findByIdAndUpdate(
        req.params.id,
        {
          requestStatus: "rejected",
          isApproved: false,
          rejectionReason: reason || "No reason provided"
        },
        { new: true }
      ).populate("owner", "name email");

      if (!shop) {
        return res.status(404).json({
          status: "fail",
          message: "Shop not found"
        });
      }

      console.log(`Admin ${req.user.name} rejected shop activation for ${shop.name}`);

      // إرسال إشعار فوري لصاحب المتجر عبر WebSocket
      try {
        const { getChatIO } = await import('../sockets/socketService.js');
        const io = getChatIO();

        // إرسال إشعار لصاحب المتجر
        io.to(shop.owner._id.toString()).emit('shopRejected', {
          shopId: shop._id,
          shopName: shop.name,
          reason: reason || "No reason provided",
          message: 'تم رفض طلب تفعيل متجرك. يمكنك مراجعة السبب وإعادة التقديم.',
          timestamp: new Date()
        });

        console.log(`Rejection notification sent to shop owner ${shop.owner.email}`);
      } catch (socketError) {
        console.error('Error sending socket notification:', socketError);
        // لا نفشل العملية إذا فشل الإشعار
      }

      res.json({
        status: "success",
        message: "Shop activation rejected",
        data: shop
      });
    } catch (error) {
      console.error(`Error rejecting shop activation:`, error);
      res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  }
);

// الحصول على طلبات التفعيل المعلقة (للأدمن)
router.get(
  "/admin/pending-activations",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const pendingShops = await Shop.find({
        requestStatus: "pending"
      }).populate("owner", "name email phone");

      res.json({
        status: "success",
        data: pendingShops,
        count: pendingShops.length
      });
    } catch (error) {
      console.error(`Error fetching pending activations:`, error);
      res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  }
);

// QR Code routes
router.post("/:id/qr-code/generate", authenticateUser, generateShopQRCode);
router.get("/:id/qr-code", authenticateUser, getShopQRCode);

// Commercial Record route for admin
router.get("/:id/commercial-record", authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔍 Admin ${req.user.email} requesting commercial record for shop ${id}`);

    // Find the shop
    const shop = await Shop.findById(id);
    if (!shop) {
      console.log(`❌ Shop not found: ${id}`);
      return res.status(404).json({
        status: "fail",
        message: "Shop not found"
      });
    }

    if (!shop.commercialRecord) {
      console.log(`❌ No commercial record found for shop: ${id}`);
      return res.status(404).json({
        status: "fail",
        message: "No commercial record found for this shop"
      });
    }

    // Build the file path
    const filePath = path.join(process.cwd(), "uploads", "commercial-records", shop.commercialRecord);
    console.log(`📁 Looking for file at: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Commercial record file not found: ${filePath}`);
      return res.status(404).json({
        status: "fail",
        message: "Commercial record file not found on server"
      });
    }

    // Set appropriate headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${shop.commercialRecord}"`);
    res.setHeader('Cache-Control', 'no-cache');

    console.log(`✅ Serving commercial record: ${shop.commercialRecord}`);

    // Send the file
    res.sendFile(filePath);

  } catch (error) {
    console.error(`❌ Error serving commercial record:`, error);
    res.status(500).json({
      status: "error",
      message: "Failed to download commercial record",
      error: error.message
    });
  }
});

export default router;
