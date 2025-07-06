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
  // Generate AI description
  let aiDescription = description; // Fallback to original description

  try {
    console.log('Generating AI description for:', title);
    const aiService = new AIProductDescriptionService(process.env.OPENAI_API_KEY);
    aiDescription = await aiService.generateDescription({
      name: title,
      category: "Jewelry",
      features: [description],
      targetAudience: "General Public",
      basicDescription: description
    });
  } catch (error) {
    console.error('AI error:', error);
    // Fallback to original description if AI fails
    aiDescription = description;
  }
  
  const newProduct = new Product({
    title,
    description: aiDescription, // Use AI-generated description
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

export const getAllProducts = catchAsync(async (req, res) => {
  const products = await Product.find();
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
  if(!product){
    return res
      .status(404)
      .json({ status: "fail", message: "Product not found" });
  }
  res.status(200).json({ status: "success", message: "Product deleted" });
});


export const addToFav = catchAsync(async (req, res) => {
  const { userId, productId} = req.body;

  const existingFavorite = await Favorite.findOne({ 
    user: userId, 
    product: productId 
  });

  if (existingFavorite) {
    return res.status(400).json({
      status: "Already exists",
      message: "Product already in favorites"
    });
  }

  const newFavorite = await Favorite.create({
    user: userId,
    product: productId
  });

  res.status(201).json({
    status: "Added", 
    message: "Product added to favorites",
    data: newFavorite
  });
})

export const getAllFav = catchAsync(async (req, res)=> {
  const {id} = req.params;
  const favorites = await Favorite.find({ user: id })
  .populate('product')
  .exec()

  return res.status(200).json({
    status: "success", 
    results: favorites.length,
    data: { favorites }
  })
})

export const removeFromFav = catchAsync(async (req, res) => {
  const { userId, productId } = req.body;

  // Find and delete the favorite entry
  const deletedFavorite = await Favorite.findOneAndDelete({
    user: userId,
    product: productId
  });

  if (!deletedFavorite) {
    return res.status(404).json({
      status: "Not Found",
      message: "Product not found in favorites"
    });
  }

  res.status(200).json({
    status: "Removed", 
    message: "Product removed from favorites"
  });
})