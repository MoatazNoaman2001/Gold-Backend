import { catchAsync } from "../utils/wrapperFunction.js";
import BookingTime from "../models/bookingTimeModel.js";
import Shop from "../models/shopModel.js";

export const addAvailableTime = catchAsync(async (req, res) => {
  const { date, time } = req.body;

  console.log("Adding available time:", { date, time, userId: req.user._id });

  const shop = await Shop.findOne({ owner: req.user._id });

  if (!shop) {
    return res.status(400).json({
      status: "fail",
      message: "Shop not found for this user",
    });
  }

  // Check if this exact date and time slot already exists
  const existing = await BookingTime.findOne({
    shop: shop._id,
    date: new Date(date),
    time: time,
  });

  if (existing) {
    return res.status(400).json({
      status: "fail",
      message: "Time slot already exists for this date and time",
    });
  }

  const newTime = await BookingTime.create({
    shop: shop._id,
    date: new Date(date),
    time: time,
    isBooked: false,
  });

  console.log("Created new time slot:", newTime);

  res.status(201).json({
    status: "success",
    data: newTime,
  });
});

export const getAvailableTimesForShop = catchAsync(async (req, res) => {
  const { shopId } = req.params;
  const { date, includeBooked } = req.query; // Optional date filter and includeBooked flag

  console.log(
    "Getting times for shop:",
    shopId,
    "date:",
    date,
    "includeBooked:",
    includeBooked
  );

  let query = {
    shop: shopId,
  };

  // If includeBooked is not true, only get available times
  if (includeBooked !== "true") {
    query.isBooked = false;
  }

  // If date is provided, filter by that date, otherwise get future dates
  if (date) {
    const targetDate = new Date(date);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    query.date = {
      $gte: targetDate,
      $lt: nextDay,
    };
  } else {
    // Get all future times
    query.date = { $gte: new Date() };
  }

  const times = await BookingTime.find(query)
    .populate("shop", "name")
    .populate("user", "name email phone") // Populate user info for booked times
    .sort({ date: 1, time: 1 });

  console.log(
    `Found ${includeBooked === "true" ? "all" : "available"} times:`,
    times.length
  );

  res.status(200).json({
    status: "success",
    data: times,
  });
});

export const bookTime = catchAsync(async (req, res) => {
  const { timeId, notes, appointmentType } = req.body;
  const userId = req.user._id;

  console.log("Booking time:", { timeId, userId, notes, appointmentType });

  const time = await BookingTime.findById(timeId).populate(
    "shop",
    "name owner"
  );

  if (!time) {
    return res.status(404).json({
      status: "fail",
      message: "Time slot not found",
    });
  }

  if (time.isBooked) {
    return res.status(400).json({
      status: "fail",
      message: "Time slot already booked",
    });
  }

  // Update the time slot
  time.isBooked = true;
  time.user = userId;
  time.notes = notes || "";
  time.appointmentType = appointmentType || "consultation";

  await time.save();

  // Populate user info for response
  await time.populate("user", "name email phone");

  console.log("Successfully booked time slot:", time);

  res.status(200).json({
    status: "success",
    data: time,
    message: "Appointment booked successfully",
  });
});

// Get shop owner's bookings
export const getShopBookings = catchAsync(async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id });

  if (!shop) {
    return res.status(404).json({
      status: "fail",
      message: "Shop not found for this user",
    });
  }

  const bookings = await BookingTime.find({
    shop: shop._id,
    isBooked: true,
  })
    .populate("user", "name email phone")
    .populate("shop", "name")
    .sort({ date: 1, time: 1 });

  res.status(200).json({
    status: "success",
    data: bookings,
  });
});

// Get user's bookings
export const getUserBookings = catchAsync(async (req, res) => {
  const bookings = await BookingTime.find({
    user: req.user._id,
    isBooked: true,
  })
    .populate("shop", "name address phone")
    .sort({ date: 1, time: 1 });

  res.status(200).json({
    status: "success",
    data: bookings,
  });
});

// Cancel booking
export const cancelBooking = catchAsync(async (req, res) => {
  const { timeId } = req.params;
  const userId = req.user._id;

  const booking = await BookingTime.findById(timeId);

  if (!booking) {
    return res.status(404).json({
      status: "fail",
      message: "Booking not found",
    });
  }

  // Check if user owns this booking
  if (booking.user.toString() !== userId.toString()) {
    return res.status(403).json({
      status: "fail",
      message: "You can only cancel your own bookings",
    });
  }

  // Reset the booking
  booking.isBooked = false;
  booking.user = undefined;
  booking.notes = "";
  booking.appointmentType = "consultation";

  await booking.save();

  res.status(200).json({
    status: "success",
    message: "Booking cancelled successfully",
  });
});

// Delete available time slot (shop owner only)
export const deleteAvailableTime = catchAsync(async (req, res) => {
  const { timeId } = req.params;

  const shop = await Shop.findOne({ owner: req.user._id });

  if (!shop) {
    return res.status(404).json({
      status: "fail",
      message: "Shop not found for this user",
    });
  }

  const timeSlot = await BookingTime.findOne({
    _id: timeId,
    shop: shop._id,
  });

  if (!timeSlot) {
    return res.status(404).json({
      status: "fail",
      message: "Time slot not found",
    });
  }

  if (timeSlot.isBooked) {
    return res.status(400).json({
      status: "fail",
      message: "Cannot delete a booked time slot",
    });
  }

  await BookingTime.findByIdAndDelete(timeId);

  res.status(200).json({
    status: "success",
    message: "Time slot deleted successfully",
  });
});
