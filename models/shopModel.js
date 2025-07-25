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
    requestStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: {
      type: String,
      default: "",
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

    location: {
      type: {
        type: String,
        enum: ["Point"], // 'location.type' must be 'Point'
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: false, 
      },
    },
    commercialRecord: {
      type: String, // PDF file URL
      required: [true, "سجل تجاري PDF مطلوب"],
    },
    qrCode: {
      type: String, // QR Code image URL or base64 data
      default: null,
    },
    qrCodeUrl: {
      type: String, // The URL that the QR code points to
      default: null,
    },

  },
  

  { timestamps: true }
);

const Shop = mongoose.model("Shop", shopSchema);

export default Shop;
