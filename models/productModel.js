import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    price: {
      type: mongoose.Decimal128,
    },
    karat: {
      type: String,
      enum: ["18", "21", "24"],
      required: true,
    },
    weight: {
      type: mongoose.Decimal128,
      required: true,
    },
    design_type: {
      type: String,
      enum: [
        "rings",
        "chains",
        "bracelets",
        "earrings",
        "necklaces",
        "pendants",
        "sets",
        "watches",
        "other",
      ],
      default: "other",
      required: true,
    },
    category: {
      type: String,
      enum: [
           "rings",
        "chains",
        "bracelets",
        "earrings",
        "necklaces",
        "pendants",
        "sets",
        "watches",
        "other",
        ],
      default: "other",
    },
    images_urls: [
      {
        type: String,
      },
    ],
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    logoUrl: {
      type: String,
    },
    images: {
      type: [String],
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    // Rating fields
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    numRatings: {
      type: Number,
      default: 0,
      min: 0,
    },
    ratingDistribution: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      5: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
