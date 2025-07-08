import { catchAsync } from "../utils/wrapperFunction.js";
import Product from "../models/productModel.js";
import Favorite from "../models/FavModels.js";
import AIProductDescriptionService from "../services/aiProductDescriptionService.js";
import UserBehavior from "../models/userBehaviorModel.js";

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

  let aiDescription; // Declare here

  try {
    // Initialize AI service with API key
    const aiService = new AIProductDescriptionService(
      process.env.OPENAI_API_KEY
    );
    // Generate AI-based product description
    aiDescription = await aiService.generateDescription({
      name: title,
      category: "Jewelry",
      features: [description],
      targetAudience: "General Public",
      basicDescription: description,
    });
  } catch (error) {
    console.error("Error generating AI description:", error);
    return res.status(500).json({
      status: "fail",
      message: "Failed to generate AI description",
    });
  }

  const newProduct = new Product({
    title,
    description: aiDescription, // Use AI-generated description
    price,
    karat,
    weight,
    design_type: design_type || "general",
    images_urls: images_urls || [],
    shop,
  });

  const saveProduct = await newProduct.save();
  console.log("✅ Product created successfully:", saveProduct.title);

  res.status(201).json({
    status: "success",
    message: "Product created successfully",
    data: saveProduct,
  });
});

// export const getAllProducts = catchAsync(async (req, res) => {
//   let products;
//   const { shopId } = req.query;

//   if (shopId) {
//     products = await Product.find({ shop: shopId }).populate(
//       "shop",
//       "name owner isApproved"
//     );
//   }
//   else if (req.user && req.user.role === "seller") {
//     const Shop = (await import("../models/shopModel.js")).default;
//     const userShops = await Shop.find({ owner: req.user._id });
//     const shopIds = userShops.map((shop) => shop._id);

//     products = await Product.find({ shop: { $in: shopIds } }).populate(
//       "shop",
//       "name owner"
//     );
//   }
//   else {
//     products = await Product.find().populate("shop", "name owner isApproved");
//   }

//   res
//     .status(200)
//     .json({ status: "success", length: products.length, data: products });
// });

export const getAllProducts = catchAsync(async (req, res) => {
  let products;

  if (req.user) {
    const userId = req.user._id;

    const interests = await UserBehavior.aggregate([
      { $match: { userId } },
      { $group: { _id: "$design_type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const prioritizedTypes = interests.map((item) => item._id);

    products = await Product.find().populate("shop", "name");

    products.sort((a, b) => {
      const aIndex = prioritizedTypes.indexOf(a.design_type);
      const bIndex = prioritizedTypes.indexOf(b.design_type);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
  } else {
    products = await Product.find().populate("shop", "name");
  }

  res
    .status(200)
    .json({ status: "success", length: products.length, data: products });
});

export const getProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id).populate("shop", "name");
  if (!product) {
    return res
      .status(404)
      .json({ status: "fail", message: "Product not found" });
  }
  res.status(200).json({ status: "success", data: product });
});

// Get products by shop ID
export const getProductsByShop = catchAsync(async (req, res) => {
  const { shopId } = req.params;

  const Shop = (await import("../models/shopModel.js")).default;
  const shop = await Shop.findById(shopId);

  if (!shop) {
    return res.status(404).json({
      status: "fail",
      message: "Shop not found",
    });
  }

  const products = await Product.find({ shop: shopId }).populate(
    "shop",
    "name owner isApproved"
  );

  res.status(200).json({
    status: "success",
    length: products.length,
    data: products,
  });
});

export const updateProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (product) {
    const updatedProduct = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    res.status(200).json({ status: "success", data: updatedProduct });
  }
});

export const deletedProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findByIdAndDelete(id);
  if (!product) {
    return res
      .status(404)
      .json({ status: "fail", message: "Product not found" });
  }
  res.status(200).json({ status: "success", message: "Product deleted" });
});

export const addToFav = catchAsync(async (req, res) => {
  const { userId, productId } = req.body;

  const existingFavorite = await Favorite.findOne({
    user: userId,
    product: productId,
  });

  if (existingFavorite) {
    return res.status(400).json({
      status: "Already exists",
      message: "Product already in favorites",
    });
  }

  const newFavorite = await Favorite.create({
    user: userId,
    product: productId,
  });

  res.status(201).json({
    status: "Added",
    message: "Product added to favorites",
    data: newFavorite,
  });
});

export const getAllFav = catchAsync(async (req, res) => {
  const { id } = req.params;
  const favorites = await Favorite.find({ user: id })
    .populate("product")
    .exec();

  return res.status(200).json({
    status: "success",
    results: favorites.length,
    data: { favorites },
  });
});

export const removeFromFav = catchAsync(async (req, res) => {
  const { userId, productId } = req.body;

  // Find and delete the favorite entry
  const deletedFavorite = await Favorite.findOneAndDelete({
    user: userId,
    product: productId,
  });

  if (!deletedFavorite) {
    return res.status(404).json({
      status: "Not Found",
      message: "Product not found in favorites",
    });
  }

  res.status(200).json({
    status: "Removed",
    message: "Product removed from favorites",
  });
});
export const generateDescriptionVariations = catchAsync(async (req, res) => {
  const { productId } = req.params;
  // Check if productId is provided
  if (!productId) {
    return res.status(422).json({
      status: "fail",
      message: "Please provide a product ID",
    });
  }
  // Check if productId is a valid MongoDB ObjectId
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    return res.status(422).json({
      status: "fail",
      message: "Invalid product ID format",
    });
  }
  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({
      status: "fail",
      message: "Product not found",
    });
  }

  // Validate required fields
  const {
    title,
    category,
    features,
    brand,
    Design_type,
    karat,
    weight,
    images_urls,
    description,
    targetAudience,
    basicDescription,
    price,
  } = product;
  try {
    const aiService = new AIProductDescriptionService(
      process.env.OPENAI_API_KEY
    );
    const descriptions = await aiService.generateVariations(productId, 3);

    res.status(200).json({
      status: "success",
      data: descriptions,
    });
  } catch (error) {
    console.error("Error generating description variations:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to generate descriptions",
    });
  }
});

export const regenerateDescription = catchAsync(async (req, res) => {
  const { productId } = req.params;
  // Check if productId is provided
  if (!productId) {
    return res.status(422).json({
      status: "fail",
      message: "Please provide a product ID",
    });
  }
  // Check if productId is a valid MongoDB ObjectId
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    return res.status(422).json({
      status: "fail",
      message: "Invalid product ID format",
    });
  }
  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({
      status: "fail",
      message: "Product not found",
    });
  }

  try {
    const aiService = new AIProductDescriptionService(
      process.env.OPENAI_API_KEY
    );
    const newDescription = await aiService.generateDescription({
      name: product.title,
      category: "Jewelry",
      features: [product.description],
      targetAudience: "General Public",
      basicDescription: product.description,
    });

    // Update the product with the new description
    product.description = newDescription;
    await product.save();

    res.status(200).json({
      status: "success",
      data: { description: newDescription },
    });
  } catch (error) {
    console.error("Error regenerating description:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to regenerate description",
    });
  }
});

export const trackProductClick = catchAsync(async (req, res) => {
  const { productId } = req.body;
  const userId = req.user._id;

  const product = await Product.findById(productId);
  if (!product) {
    return res
      .status(404)
      .json({ status: "fail", message: "Product not found" });
  }

  await UserBehavior.create({
    userId,
    productId,
    design_type: product.design_type,
  });

  res.status(201).json({ status: "success", message: "Interaction tracked" });
});
