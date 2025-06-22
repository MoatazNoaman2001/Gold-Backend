import { catchAsync } from "../utlites/wrapperFunction.js";
import Product from "../models/productModel.js";

export const createProduct = catchAsync(async (req, res) => {
  const {
    title,
    description,
    price,
    karat,
    weight,
    design_type,
    images_urls,
    shop,
  } = req.body;
  const newProduct = new Product({
    title,
    description,
    price,
    karat,
    weight,
    design_type,
    images_urls,
    shop,
  });
  const saveProduct = await newProduct.save();
  res.status(200).json({ status: "success", data: saveProduct });
});
