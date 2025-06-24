import mongoose from "mongoose";

const shopSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner ID is required"],
    },
    name: String,
    logoUrl: String,
    description: String,
    city: String,
    area: String,
    whatsapp: String,
    subscriptionPlan: {
      type: String,
      enum: ["Basic", "Premium", "Gold"],
      default: "Basic",
    },
    isApproved: { type: Boolean, default: false },
    averageRating: {
    type: Number,
    default: 0
  },
  },
  
  { timestamp: true }
);

const Shop = mongoose.model("Shop", shopSchema);

export default Shop;
