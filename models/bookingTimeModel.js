import mongoose, { Schema } from "mongoose";

const bookingTimeSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true, // e.g., "10:00", "14:30"
    },
    isBooked: { type: Boolean, default: false },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Who booked this slot
    notes: { type: String, maxlength: 500 },
    appointmentType: {
      type: String,
      enum: ["consultation", "viewing", "purchase", "repair"],
      default: "consultation",
    },
  },
  { timestamps: true }
);

const BookingTime = mongoose.model("BookingTime", bookingTimeSchema);
export default BookingTime;
