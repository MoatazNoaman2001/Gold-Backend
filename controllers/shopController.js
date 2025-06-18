import { catchAsync } from "../utlites/wrapperFunction.js";
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
