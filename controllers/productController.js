import { catchAsync } from "../utils/wrapperFunction.js";
import Product from "../models/productModel.js";
import Favorite from "../models/FavModels.js";
import AIProductDescriptionService  from "../services/aiProductDescriptionService.js";

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
    const aiService = new AIProductDescriptionService(process.env.OPENAI_API_KEY);              
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

export const getAllProducts = catchAsync(async (req, res) => {
  let products;
  const { shopId } = req.query;

  if (shopId) {
    products = await Product.find({ shop: shopId }).populate(
      "shop",
      "name owner isApproved"
    );
  }
  // إذا كان المستخدم بائع، أظهر منتجات متاجره فقط
  else if (req.user && req.user.role === "seller") {
    // جلب متاجر البائع أولاً
    const Shop = (await import("../models/shopModel.js")).default;
    const userShops = await Shop.find({ owner: req.user._id });
    const shopIds = userShops.map((shop) => shop._id);

    products = await Product.find({ shop: { $in: shopIds } }).populate(
      "shop",
      "name owner"
    );
  }
  // للجميع (بما في ذلك الأدمن والعملاء)، أظهر جميع المنتجات
  else {
    products = await Product.find().populate("shop", "name owner isApproved");
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

  // التحقق من وجود المتجر
  const Shop = (await import("../models/shopModel.js")).default;
  const shop = await Shop.findById(shopId);

  if (!shop) {
    return res.status(404).json({
      status: "fail",
      message: "Shop not found",
    });
  }

  // جلب منتجات المتجر
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
