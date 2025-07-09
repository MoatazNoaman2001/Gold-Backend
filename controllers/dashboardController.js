import { catchAsync } from "../utils/wrapperFunction.js";
import User from "../models/userModel.js";
import Shop from "../models/shopModel.js";
import Product from "../models/productModel.js";
import Booking from "../models/bookingModel.js";
import BookingTime from "../models/bookingTimeModel.js";

// Get user dashboard statistics
export const getUserStats = catchAsync(async (req, res) => {
  const userId = req.user._id;

  // Get user's bookings count from BookingTime model
  const bookingsCount = await BookingTime.countDocuments({ user: userId });

  // Get user's active bookings count (isBooking = true means it's booked)
  const activeBookingsCount = await BookingTime.countDocuments({
    user: userId,
    isBooking: true,
  });

  // For now, we'll use placeholder values for favorites and reviews
  // These would be implemented when we have proper models for them
  const stats = {
    favorites: 0, // Will be implemented with favorites model
    bookings: bookingsCount,
    activeBookings: activeBookingsCount,
    reviews: 0, // Will be implemented with reviews model
    totalSpent: 0, // Will be calculated from orders when implemented
  };

  res.status(200).json({
    status: "success",
    data: stats,
  });
});

// Get user's recent activity
export const getUserActivity = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const limit = parseInt(req.query.limit) || 10;

  // Get recent bookings from BookingTime model
  const recentBookings = await BookingTime.find({
    user: userId,
    isBooking: true,
  })
    .populate("shop", "name")
    .sort({ createdAt: -1 })
    .limit(limit);

  // Transform bookings to activity format
  const activities = recentBookings.map((booking) => ({
    id: booking._id,
    type: "booking",
    title: `حجز موعد في ${booking.shop?.name || "متجر غير محدد"}`,
    date: booking.date || booking.createdAt,
    status: booking.status || "pending",
    details: {
      shopName: booking.shop?.name,
      time: booking.time,
      bookingId: booking._id,
    },
  }));

  res.status(200).json({
    status: "success",
    data: activities,
  });
});

// Get shop owner dashboard statistics
export const getShopOwnerStats = catchAsync(async (req, res) => {
  const ownerId = req.user._id;

  // Get shop owner's shops
  const shops = await Shop.find({ owner: ownerId });
  const shopIds = shops.map((shop) => shop._id);

  // Get products count
  const productsCount = await Product.countDocuments({
    shop: { $in: shopIds },
  });

  // Get bookings count for owner's shops (using BookingTime model)
  const bookingsCount = await BookingTime.countDocuments({
    shop: { $in: shopIds },
    isBooking: true,
  });

  // Get pending bookings count (all booked times are considered active)
  const pendingBookingsCount = await BookingTime.countDocuments({
    shop: { $in: shopIds },
    isBooking: true,
  });

  const stats = {
    shops: shops.length,
    products: productsCount,
    bookings: bookingsCount,
    pendingBookings: pendingBookingsCount,
    customers: 0, // Will be calculated from unique booking users
    revenue: 0, // Will be calculated from completed orders
  };

  res.status(200).json({
    status: "success",
    data: stats,
  });
});

// Get shop owner's recent activity
export const getShopOwnerActivity = catchAsync(async (req, res) => {
  const ownerId = req.user._id;
  const limit = parseInt(req.query.limit) || 10;

  // Get shop owner's shops
  const shops = await Shop.find({ owner: ownerId });
  const shopIds = shops.map((shop) => shop._id);

  // Get recent bookings for owner's shops (using BookingTime model)
  const recentBookings = await BookingTime.find({
    shop: { $in: shopIds },
    isBooking: true,
  })
    .populate("user", "name email")
    .populate("shop", "name")
    .sort({ createdAt: -1 })
    .limit(limit);

  // Transform bookings to activity format
  const activities = recentBookings.map((booking) => ({
    id: booking._id,
    type: "booking",
    title: `حجز جديد من ${booking.user?.name || "عميل غير محدد"}`,
    date: booking.date || booking.createdAt,
    status: "confirmed", // BookingTime model doesn't have status, so we assume confirmed
    details: {
      customerName: booking.user?.name,
      customerEmail: booking.user?.email,
      shopName: booking.shop?.name,
      time: booking.time,
      bookingId: booking._id,
    },
  }));

  res.status(200).json({
    status: "success",
    data: activities,
  });
});

// Get user's bookings
export const getUserBookings = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { status, limit = 10 } = req.query;

  let query = { user: userId };
  if (status && status !== "all") {
    // For BookingTime model, we use isBooking field
    if (status === "confirmed") {
      query.isBooking = true;
    } else if (status === "pending") {
      query.isBooking = false;
    }
  }

  const bookings = await BookingTime.find(query)
    .populate("shop", "name address phone area city")
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  // Transform bookings to the expected format
  const formattedBookings = bookings.map((booking) => ({
    id: booking._id,
    shop: booking.shop?.name || "متجر غير محدد",
    shopId: booking.shop?._id,
    date: booking.date,
    time: "10:00 ص", // Default time since BookingTime doesn't have time field
    status: booking.isBooking ? "confirmed" : "pending",
    type: "consultation",
    address: booking.shop?.address || booking.shop?.area || booking.shop?.city,
    phone: booking.shop?.phone,
    createdAt: booking.createdAt,
  }));

  res.status(200).json({
    status: "success",
    result: formattedBookings.length,
    data: formattedBookings,
  });
});

// Cancel booking
export const cancelBooking = catchAsync(async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.user._id;

  const booking = await BookingTime.findOne({ _id: bookingId, user: userId });

  if (!booking) {
    return res.status(404).json({
      status: "fail",
      message: "Booking not found or you don't have permission to cancel it",
    });
  }

  // For BookingTime model, set isBooking to false to cancel
  booking.isBooking = false;
  await booking.save();

  res.status(200).json({
    status: "success",
    message: "Booking cancelled successfully",
    data: booking,
  });
});

// Update booking
export const updateBooking = catchAsync(async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.user._id;
  const updateData = req.body;

  const booking = await Booking.findOne({ _id: bookingId, user: userId });

  if (!booking) {
    return res.status(404).json({
      status: "fail",
      message: "Booking not found or you don't have permission to update it",
    });
  }

  // Update allowed fields
  const allowedUpdates = ["date", "time", "type"];
  allowedUpdates.forEach((field) => {
    if (updateData[field] !== undefined) {
      booking[field] = updateData[field];
    }
  });

  await booking.save();

  res.status(200).json({
    status: "success",
    message: "Booking updated successfully",
    data: booking,
  });
});
