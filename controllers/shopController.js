import { catchAsync } from "../utils/wrapperFunction.js";
import Shop from "../models/shopModel.js";

export const createShop = catchAsync(async (req, res) => {
  const newShop = await Shop.create({
    ...req.body,
    owner: req.user._id, // assuming you're using auth middleware
  });
  res.status(201).json({
    status: "success",
    data: newShop,
  });
});

export const getAllShops = catchAsync(async (req, res) => {
  const shops = await Shop.find();
  res.status(200).json({
    status: "success",
    result: shops.length,
    data: shops,
  });
});

export const getShop = catchAsync(async (req, res) => {
  const { id } = req.params;
  const shop = await Shop.findById(id).populate("owner", "name email");
  if (!shop) {
    return res.status(404).json({
      status: "fail",
      message: "Shop not found",
    });
  }
  res.status(200).json({
    status: "success",
    data: shop,
  });
});

export const deleteShop = catchAsync(async (req, res) => {
  const { id } = req.params;
  const shop = await Shop.findByIdAndDelete(id);
  if (!shop) {
    return res.status(404).json({
      status: "fail",
      message: "Shop not found",
    });
  }
  res.status(204).json({
    status: "success",
    message: "Shop deleted successfully",
  });
});
export const updateShop = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updatedShop = await Shop.findByIdAndUpdate(
    id,
    req.body,
    { new: true, runValidators: true }
  ).populate("owner", "name email");
  if (!updatedShop) {
    return res.status(404).json({
      status: "fail",
      message: "Shop not found",
    });
  }
  res.status(200).json({
    status: "success",
    data: updatedShop,
  });
});   