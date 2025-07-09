import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: [true, "Shop is required"],
    },
    date: {
      type: Date,
      required: [true, "Booking date is required"],
    },
    time: {
      type: String,
      required: [true, "Booking time is required"],
    },
    type: {
      type: String,
      enum: ["consultation", "viewing", "purchase", "repair"],
      default: "consultation",
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    customerName: String,
    customerPhone: String,
    customerEmail: String,
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ shop: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ date: 1 });

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
