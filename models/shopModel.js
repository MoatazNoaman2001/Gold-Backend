import mongoose from "mongoose";

const shopSchema = new mongoose.Schema(
  {
    owner: {type:mongoose.Schema.ObjectId, ref:"User",required:true},
    name: string,
    logoUrl: string,
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
