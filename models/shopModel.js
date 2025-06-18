import mongoose from "mongoose";

const shopSchema = new mongoose.Schema(
  {
    owner: {},
    name: {},
    logoUrl: {},
    description: String,
    city: string,
    area: string,
    whatsapp: string,
    subscriptionPlan: {
      type: String,
      enum: ["Basic", "Premium", "Gold"],
      default: "Basic",
    },
    isApproved: { type: Boolean, default: false },
  },
  { Timestamp: true }
);

export default mongoose.model("shop", shopSchema);
