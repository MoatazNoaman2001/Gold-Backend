import mongoose from "mongoose";

const behaviorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  },
  design_type: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});
export default mongoose.model("UserBehavior", behaviorSchema);
