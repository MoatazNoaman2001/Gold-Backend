import mongoose from "mongoose";

const favSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    // _id: false
  }
);

favSchema.index({ user: 1, product: 1 }, { unique: true });

const Favorite = mongoose.model("Favorite", favSchema);
export default Favorite;