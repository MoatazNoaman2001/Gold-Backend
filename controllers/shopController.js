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
export const getMyShop = catchAsync(async (req, res) => {
  const myShops = await Shop.find({ owner: req.user._id });
  if (!myShops || myShops.length === 0) {
    return res.status(404).json({
      status: "fail",
      message: "No shops found for this user",
    });
  }
  res.status(200).json({
    status: "success",
    result: myShops.length,
    data: myShops,
  });
});
