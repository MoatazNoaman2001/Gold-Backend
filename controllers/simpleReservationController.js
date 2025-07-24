import mongoose from "mongoose";
import { catchAsync } from "../utils/wrapperFunction.js";
import Product from "../models/productModel.js";
import Shop from "../models/shopModel.js";
import User from "../models/userModel.js";
import NotificationService from "../services/notificationService.js";

// Simple reservation model (using existing structure)
const reservationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    reservationAmount: {
      type: Number,
      required: true,
    },
    remainingAmount: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "PENDING",
        "ACTIVE",
        "CONFIRMED",
        "READY_FOR_PICKUP",
        "COMPLETED",
        "CANCELLED",
        "EXPIRED",
      ],
      default: "PENDING",
    },
    reservationDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["card", "wallet", "cash"],
      default: "card",
    },
    confirmationDate: Date,
    cancelationDate: Date,
    cancelationReason: String,
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Create indexes
reservationSchema.index({ userId: 1, status: 1 });
reservationSchema.index({ productId: 1, status: 1 });
reservationSchema.index({ shopId: 1, status: 1 });
reservationSchema.index({ expiryDate: 1 });

const SimpleReservation = mongoose.model(
  "SimpleReservation",
  reservationSchema
);

// Helper functions
const calculateReservationAmount = (totalPrice) => {
  const reservationAmount = Math.round(totalPrice * 0.1); // 10%
  const remainingAmount = totalPrice - reservationAmount;
  return {
    reservationAmount,
    remainingAmount,
    totalAmount: totalPrice,
  };
};

const calculateExpiryDate = (reservationDate) => {
  const expiryDate = new Date(reservationDate);
  expiryDate.setDate(expiryDate.getDate() + 7); // 7 days from reservation
  return expiryDate;
};

// Create a new reservation
export const createReservation = catchAsync(async (req, res) => {
  const { productId, paymentMethod = "card" } = req.body;
  const userId = req.user._id;

  // Validate input
  if (!productId) {
    return res.status(400).json({
      status: "fail",
      message: "Product ID is required",
    });
  }

  // Check if product exists
  const product = await Product.findById(productId).populate("shop");
  if (!product) {
    return res.status(404).json({
      status: "fail",
      message: "Product not found",
    });
  }

  // Check if product is already reserved
  const existingReservation = await SimpleReservation.findOne({
    productId,
    status: { $in: ["PENDING", "ACTIVE", "CONFIRMED"] },
  });

  if (existingReservation) {
    return res.status(400).json({
      status: "fail",
      message: "Product is already reserved",
    });
  }

  // Calculate amounts
  const amounts = calculateReservationAmount(product.price);
  const expiryDate = calculateExpiryDate(new Date());

  // Create reservation
  const reservation = await SimpleReservation.create({
    userId,
    productId,
    shopId: product.shop._id,
    ...amounts,
    paymentMethod,
    expiryDate,
    status: "ACTIVE", // Skip PENDING for simplicity
  });

  // Populate reservation data
  await reservation.populate([
    { path: "userId", select: "name email phone" },
    { path: "productId", select: "name price images" },
    { path: "shopId", select: "name owner" },
  ]);

  // Send notifications
  try {
    // إشعار لصاحب المتجر
    await NotificationService.createNotification({
      recipient: product.shop.owner,
      sender: userId,
      type: "reservation",
      title: "🎉 حجز منتج جديد",
      message: `تم حجز منتج "${product.name}" من قبل ${req.user.name} بمبلغ ${amounts.reservationAmount} جنيه`,
      data: {
        reservationId: reservation._id,
        productId,
        productName: product.name,
        customerName: req.user.name,
        customerPhone: req.user.phone,
        reservationAmount: amounts.reservationAmount,
        remainingAmount: amounts.remainingAmount,
        expiryDate: expiryDate,
      },
    });

    console.log(`📢 تم إرسال إشعار لصاحب المتجر: ${product.shop.owner}`);

    // إشعار تأكيد للعميل
    await NotificationService.createNotification({
      recipient: userId,
      sender: product.shop.owner,
      type: "success",
      title: "✅ تم تأكيد حجزك",
      message: `تم حجز منتج "${product.name}" بنجاح. سيتم التواصل معك قريباً لتحديد موعد الاستلام.`,
      data: {
        reservationId: reservation._id,
        productId,
        productName: product.name,
        shopName: product.shop.name,
        reservationAmount: amounts.reservationAmount,
        remainingAmount: amounts.remainingAmount,
        expiryDate: expiryDate,
        status: "ACTIVE",
      },
    });

    console.log(`✅ تم إرسال إشعار تأكيد للعميل: ${userId}`);
  } catch (error) {
    console.error("❌ فشل في إرسال الإشعارات:", error);
  }

  res.status(201).json({
    status: "success",
    message: "Reservation created successfully",
    data: {
      _id: reservation._id,
      reservationId: reservation._id,
      amount: reservation.reservationAmount,
      remainingAmount: reservation.remainingAmount,
      status: reservation.status,
      productId: reservation.productId,
      shopId: reservation.shopId,
      createdAt: reservation.createdAt,
    },
  });
});

// Get user reservations
export const getUserReservations = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { status, page = 1, limit = 10 } = req.query;

  const query = { userId };
  if (status && status !== "all") {
    query.status = status;
  }

  const reservations = await SimpleReservation.find(query)
    .populate([
      { path: "productId", select: "name price images description category" },
      { path: "shopId", select: "name location phone email rating" },
    ])
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  // تحويل البيانات لتكون متوافقة مع الفرونت إند
  const formattedReservations = reservations.map((reservation) => ({
    _id: reservation._id,
    amount: reservation.reservationAmount,
    remainingAmount: reservation.remainingAmount,
    status: reservation.status,
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt,
    product: {
      _id: reservation.productId?._id,
      name: reservation.productId?.name,
      price: reservation.productId?.price,
      image: reservation.productId?.images?.[0],
      description: reservation.productId?.description,
      category: reservation.productId?.category,
    },
    shop: {
      _id: reservation.shopId?._id,
      name: reservation.shopId?.name,
      location: reservation.shopId?.location,
      phone: reservation.shopId?.phone,
      email: reservation.shopId?.email,
      rating: reservation.shopId?.rating,
    },
  }));

  const total = await SimpleReservation.countDocuments(query);

  res.status(200).json({
    status: "success",
    results: formattedReservations.length,
    data: formattedReservations, // إرجاع البيانات المنسقة
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// Get shop reservations
export const getShopReservations = catchAsync(async (req, res) => {
  const { shopId } = req.params;
  const { status, page = 1, limit = 10 } = req.query;

  // Verify shop ownership
  const shop = await Shop.findById(shopId);
  if (!shop) {
    return res.status(404).json({
      status: "fail",
      message: "Shop not found",
    });
  }

  if (
    shop.owner.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return res.status(403).json({
      status: "fail",
      message: "Access denied",
    });
  }

  const query = { shopId };
  if (status && status !== "all") {
    query.status = status;
  }

  const reservations = await SimpleReservation.find(query)
    .populate([
      { path: "userId", select: "name email phone" },
      { path: "productId", select: "name price images" },
    ])
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await SimpleReservation.countDocuments(query);

  res.status(200).json({
    status: "success",
    results: reservations.length,
    data: {
      reservations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// Confirm reservation (pay remaining amount)
export const confirmReservation = catchAsync(async (req, res) => {
  const { reservationId } = req.params;
  const { paymentMethod = "card" } = req.body;
  const userId = req.user._id;

  const reservation = await SimpleReservation.findById(reservationId).populate([
    { path: "productId", select: "name price" },
    { path: "shopId", select: "name owner" },
  ]);

  if (!reservation) {
    return res.status(404).json({
      status: "fail",
      message: "Reservation not found",
    });
  }

  if (reservation.userId.toString() !== userId.toString()) {
    return res.status(403).json({
      status: "fail",
      message: "Access denied",
    });
  }

  if (reservation.status !== "ACTIVE") {
    return res.status(400).json({
      status: "fail",
      message: "Reservation cannot be confirmed",
    });
  }

  // Update reservation
  reservation.status = "CONFIRMED";
  reservation.confirmationDate = new Date();
  reservation.paymentMethod = paymentMethod;
  await reservation.save();

  // Send notification to shop owner
  try {
    await NotificationService.createNotification({
      recipient: reservation.shopId.owner,
      sender: userId,
      type: "reservation",
      title: "تأكيد حجز منتج",
      message: `تم تأكيد حجز منتج "${reservation.productId.name}" وتم دفع المبلغ كاملاً`,
      data: {
        reservationId: reservation._id,
        productName: reservation.productId.name,
        customerName: req.user.name,
        totalAmount: reservation.totalAmount,
      },
    });
  } catch (error) {
    console.error("Failed to send notification:", error);
  }

  res.status(200).json({
    status: "success",
    message: "Reservation confirmed successfully",
    data: { reservation },
  });
});

// Cancel reservation
export const cancelReservation = catchAsync(async (req, res) => {
  const { reservationId } = req.params;
  const { reason = "No reason provided" } = req.body;
  const userId = req.user._id;

  const reservation = await SimpleReservation.findById(reservationId).populate([
    { path: "productId", select: "name price" },
    { path: "shopId", select: "name owner" },
  ]);

  if (!reservation) {
    return res.status(404).json({
      status: "fail",
      message: "Reservation not found",
    });
  }

  if (reservation.userId.toString() !== userId.toString()) {
    return res.status(403).json({
      status: "fail",
      message: "Access denied",
    });
  }

  if (!["PENDING", "ACTIVE"].includes(reservation.status)) {
    return res.status(400).json({
      status: "fail",
      message: "Reservation cannot be cancelled",
    });
  }

  // Update reservation
  reservation.status = "CANCELLED";
  reservation.cancelationDate = new Date();
  reservation.cancelationReason = reason;
  await reservation.save();

  // Send notification to shop owner
  try {
    await NotificationService.createNotification({
      recipient: reservation.shopId.owner,
      sender: userId,
      type: "reservation",
      title: "إلغاء حجز منتج",
      message: `تم إلغاء حجز منتج "${reservation.productId.name}"`,
      data: {
        reservationId: reservation._id,
        productName: reservation.productId.name,
        customerName: req.user.name,
        reason,
      },
    });
  } catch (error) {
    console.error("Failed to send notification:", error);
  }

  res.status(200).json({
    status: "success",
    message: "Reservation cancelled successfully",
    data: { reservation },
  });
});

// Update reservation status (for shop owners)
export const updateReservationStatus = catchAsync(async (req, res) => {
  const { reservationId } = req.params;
  const { status, notes } = req.body;

  const reservation = await SimpleReservation.findById(reservationId).populate([
    { path: "userId", select: "name email phone" },
    { path: "productId", select: "name price" },
    { path: "shopId", select: "name owner" },
  ]);

  if (!reservation) {
    return res.status(404).json({
      status: "fail",
      message: "Reservation not found",
    });
  }

  // Verify shop ownership
  if (
    reservation.shopId.owner.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return res.status(403).json({
      status: "fail",
      message: "Access denied",
    });
  }

  // Validate status transition
  const validTransitions = {
    ACTIVE: ["READY_FOR_PICKUP", "CANCELLED"],
    CONFIRMED: ["READY_FOR_PICKUP", "COMPLETED", "CANCELLED"],
    READY_FOR_PICKUP: ["COMPLETED", "CANCELLED"],
  };

  const allowedStatuses = validTransitions[reservation.status] || [];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      status: "fail",
      message: `Cannot transition from ${reservation.status} to ${status}`,
    });
  }

  // Update reservation
  reservation.status = status;
  if (notes) {
    reservation.notes = notes;
  }
  await reservation.save();

  // Send notification to customer
  try {
    let notificationMessage = "";
    switch (status) {
      case "READY_FOR_PICKUP":
        notificationMessage = `منتجك "${reservation.productId.name}" جاهز للاستلام من المتجر`;
        break;
      case "COMPLETED":
        notificationMessage = `تم تسليم منتجك "${reservation.productId.name}" بنجاح`;
        break;
      case "CANCELLED":
        notificationMessage = `تم إلغاء حجز منتجك "${reservation.productId.name}" من قبل المتجر`;
        break;
    }

    if (notificationMessage) {
      await NotificationService.createNotification({
        recipient: reservation.userId._id,
        sender: req.user._id,
        type: "reservation",
        title: "تحديث حالة الحجز",
        message: notificationMessage,
        data: {
          reservationId: reservation._id,
          productName: reservation.productId.name,
          shopName: reservation.shopId.name,
          newStatus: status,
          notes,
        },
      });
    }
  } catch (error) {
    console.error("Failed to send notification:", error);
  }

  res.status(200).json({
    status: "success",
    message: "Reservation status updated successfully",
    data: { reservation },
  });
});

// Process payment (simulate real payment)
export const processPayment = catchAsync(async (req, res) => {
  const { productId, amount, paymentMethod, cardDetails } = req.body;
  const userId = req.user._id;

  // Validate input
  if (!productId || !amount || !paymentMethod) {
    return res.status(400).json({
      status: "fail",
      message: "Missing required payment information",
    });
  }

  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({
      status: "fail",
      message: "Product not found",
    });
  }

  // Validate amount (should be 10% of product price)
  const expectedAmount = Math.round(product.price * 0.1);
  if (amount !== expectedAmount) {
    return res.status(400).json({
      status: "fail",
      message: "Invalid payment amount",
    });
  }

  try {
    // Simulate payment processing delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Here you would integrate with real payment gateway
    // For now, we'll simulate successful payment
    const paymentResult = {
      paymentId: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: "succeeded",
      amount,
      currency: "EGP",
      paymentMethod,
      processedAt: new Date(),
      ...(cardDetails && {
        card: {
          last4: cardDetails.last4,
          brand: cardDetails.brand || "visa",
        },
      }),
    };

    // Log payment for debugging
    console.log("💳 Payment processed:", {
      userId: userId.toString(),
      productId,
      amount,
      paymentMethod,
      paymentId: paymentResult.paymentId,
    });

    res.status(200).json({
      status: "success",
      message: "Payment processed successfully",
      data: {
        payment: paymentResult,
        product: {
          id: product._id,
          name: product.name,
          price: product.price,
        },
      },
    });
  } catch (error) {
    console.error("Payment processing error:", error);
    res.status(500).json({
      status: "error",
      message: "Payment processing failed",
      error: error.message,
    });
  }
});

export { SimpleReservation };
