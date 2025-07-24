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
    // حالة المتجر الجديدة
    status: {
      type: String,
      enum: ["pending", "approved", "active", "rejected"],
      default: "pending",
    },
    // الحقول القديمة للتوافق مع الكود الموجود
    isApproved: {
      type: Boolean,
      default: false,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    approvedAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    // معلومات الموافقة والدفع
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    paymentDetails: {
      transactionId: String,
      amount: Number,
      currency: String,
      paymentDate: Date,
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
  },

  { timestamps: true }
);

// Middleware للحفاظ على التوافق مع الحقول القديمة
shopSchema.pre("save", function (next) {
  // تحديث isApproved بناءً على status
  this.isApproved = this.status === "approved" || this.status === "active";

  // تحديث isPaid بناءً على status
  this.isPaid = this.status === "active";

  next();
});

// Virtual للحصول على حالة المتجر بشكل واضح
shopSchema.virtual("shopStatus").get(function () {
  return {
    status: this.status,
    isApproved: this.isApproved,
    isPaid: this.isPaid,
    canPay: this.status === "approved" && !this.isPaid,
    isActive: this.status === "active",
  };
});

// تأكد من إرجاع virtuals في JSON
shopSchema.set("toJSON", { virtuals: true });
shopSchema.set("toObject", { virtuals: true });

const Shop = mongoose.model("Shop", shopSchema);

export default Shop;
