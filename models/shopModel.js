import mongoose from "mongoose";

const shopSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner ID is required"],
    },
    name: {
      type: String,
      required: [true, "Shop name is required"],
    },
    logoUrl: String,
    images: [String], // Shop main image
    description: String,
    city: String,
    area: String,
    address: String, // Full address
    phone: String, // Shop phone number
    whatsapp: String,
    specialties: [String], // Array of specialties like ["خواتم", "قلائد", "أساور"]
    workingHours: {
      type: String,
      default: "9:00 ص - 9:00 م",
    },
    subscriptionPlan: {
      type: String,
      enum: ["Basic", "Premium", "Gold"],
      default: "Basic",
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    averageRating: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 0,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
  },

  { timestamps: true }
);

const Shop = mongoose.model("Shop", shopSchema);

export default Shop;
