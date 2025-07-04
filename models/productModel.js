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
      required: true,
    },
    karat: {
      type: String,
      enum: ["18K", "21K", "24K"],
      required: true,
    },
    weight: {
      type: mongoose.Decimal128,
      required: true,
    },
    design_type: {
      type: String,
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
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
