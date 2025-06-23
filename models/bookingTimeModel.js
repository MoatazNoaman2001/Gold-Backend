import mongoose, { Schema } from "mongoose";

const bookingTimeSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    date: {
      type: Date,
      required: true,
    },
    isBooking: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const BookingTime = mongoose.model("BookingTime", bookingTimeSchema);
export default BookingTime;
