import { catchAsync } from "../utils/wrapperFunction.js";
import Product from "../models/productModel.js";
import Favorite from "../models/FavModels.js";
import AIProductDescriptionService from "../services/aiProductDescriptionService.js";
import UserBehavior from "../models/userBehaviorModel.js";
import multer from "multer";
import path from 'path';


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/product-images/");
  },
  filename: (req, file, cb) => {
    const sanitizedFilename = file.originalname
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-.]/g, '')
      .toLowerCase();
    cb(null, `${Date.now()}-${sanitizedFilename}`);
  },
});

const fileFilter = (req, file, cb) => {
  console.log(JSON.stringify(file));
  
  const filetypes = /jpeg|jpg|png|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error("Only images (jpeg, jpg, png) are allowed: ", file.originalname));
};

export const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter,
}).fields([
  { name: "logo", maxCount: 1 },
  { name: "images", maxCount: 10 },
]);

export const createProduct = catchAsync(async (req, res) => {
  let productData = req.body;
  let {logo , images} = req.files || {};
  let { title, description, price, karat, weight, design_type, category, images_urls, shop } = productData;
  
  // Validate design_type
  const validDesignTypes = [
    "rings",
    "chains",
    "bracelets",
    "earrings",
    "necklaces",
    "pendants",
    "sets",
    "watches",
    "other",
  ];

  if (design_type && !validDesignTypes.includes(design_type)) {
    return res.status(400).json({
      status: "fail",
      message: `Invalid design_type. Must be one of: ${validDesignTypes.join(
        ", "
      )}`,
    });
  }
  console.log("Incoming productData:", productData);

 if (!description){
  let aiDescription; // Declare here

  try {
    // Initialize AI service with API key
    const aiService = new AIProductDescriptionService(
      process.env.OPENAI_API_KEY
    );
    // Generate AI-based product description
    aiDescription = await aiService.generateDescription(productData);
  } catch (error) {
    console.error("Error generating AI description:", error);
    return res.status(500).json({
      status: "fail",
      message: "Failed to generate AI description",
    });
  }
  description = aiDescription; // Assign AI-generated description
 }
  const newProduct = new Product({
    title,
    description,
    price,
    karat,
    weight,
    design_type: design_type || "other",
    category: category || design_type || "other",
    images_urls: images_urls || [],
    shop,
    logoUrl: logo ? logo[0].filename : undefined,
    images: images ? images.map(file => `${file.filename}`) : [],
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
  const { category, minPrice, maxPrice, karat, design_type, search, sortBy } =
    req.query;

  // Build filter object
  let filter = {};

  if (category) {
    filter.design_type = category;
  }

  if (design_type) {
    filter.design_type = design_type;
  }

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  if (karat) {
    filter.karat = Number(karat);
  }



  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (req.user) {
    const userId = req.user._id;

    // Get user interests from behavior
    const interests = await UserBehavior.aggregate([
      { $match: { userId } },
      { $group: { _id: "$design_type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const prioritizedTypes = interests.map((item) => item._id);

    products = await Product.find(filter).populate("shop", "name");

    // Sort based on user behavior if no specific sort requested
    if (!sortBy || sortBy === "recommended") {
      products.sort((a, b) => {
        const aIndex = prioritizedTypes.indexOf(a.design_type);
        const bIndex = prioritizedTypes.indexOf(b.design_type);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });
    }
  } else {
    products = await Product.find(filter).populate("shop", "name");
  }

  // Apply additional sorting
  if (sortBy) {
    switch (sortBy) {
      case "price_low":
        products.sort((a, b) => a.price - b.price);
        break;
      case "price_high":
        products.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case "oldest":
        products.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case "name":
        products.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
  }

  res
    .status(200)
    .json({ status: "success", length: products.length, data: products });
});

export const getProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id).populate("shop", "name");

  const userId = req.user._id;
  
  if (!userId){
    return res.status(400).json({
      message: "user must be authed"
    })
  }
  
  // Check if the favorite already exists
  const existingFavorite = await Favorite.findOne({
    user: userId,
    product: product._id,
  });
  
  if (existingFavorite){
    product.isFav = true;
  }
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
  const { design_type, category } = req.body;

  // Validate design_type if provided
  const validDesignTypes = [
    "rings",
    "chains",
    "bracelets",
    "earrings",
    "necklaces",
    "pendants",
    "sets",
    "watches",
    "other",
  ];

  if (design_type && !validDesignTypes.includes(design_type)) {
    return res.status(400).json({
      status: "fail",
      message: `Invalid design_type. Must be one of: ${validDesignTypes.join(
        ", "
      )}`,
    });
  }

  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({
      status: "fail",
      message: "Product not found",
    });
  }

  // If design_type is updated, also update category if not provided
  if (design_type && !category) {
    req.body.category = design_type;
  }

  const updatedProduct = await Product.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: updatedProduct,
  });
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


export const getAllFav = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const favorites = await Favorite.find({ user: userId })
    .populate("product")
    .exec();

  return res.status(200).json({
    status: "success",
    results: favorites.length,
    data: { favorites },
  });
});
export const toggleFavorite = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;
  
  // Check if the favorite already exists
  const existingFavorite = await Favorite.findOne({
    user: userId,
    product: productId,
  });

  if (existingFavorite) {
    // If exists, remove it
    await Favorite.findByIdAndDelete(existingFavorite._id);
    
    return res.status(200).json({
      status: "Removed",
      message: "Product removed from favorites",
      data: null
    });
  } else {
    // If doesn't exist, add it
    const newFavorite = await Favorite.create({
      user: userId,
      product: productId,
    });

    return res.status(201).json({
      status: "Added",
      message: "Product added to favorites",
      data: newFavorite
    });
  }
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

  // Product exists, proceed with generating variations
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

export const getRelatedProducts = catchAsync(async (req, res) => {
  const userId = req.user?._id;
  const { limit = 8 } = req.query;

  if (!userId) {
    // For non-authenticated users, return random products
    const products = await Product.find()
      .populate("shop", "name")
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: "success",
      length: products.length,
      data: products,
    });
  }

  // Get user's viewing history
  const userBehavior = await UserBehavior.find({ userId })
    .sort({ createdAt: -1 })
    .limit(20);

  if (userBehavior.length === 0) {
    // No behavior data, return newest products
    const products = await Product.find()
      .populate("shop", "name")
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: "success",
      length: products.length,
      data: products,
    });
  }

  // Get user's preferred design types
  const designTypePreferences = await UserBehavior.aggregate([
    { $match: { userId } },
    { $group: { _id: "$design_type", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 3 },
  ]);

  const preferredTypes = designTypePreferences.map((item) => item._id);
  const viewedProductIds = userBehavior.map((item) => item.productId);

  // Find related products based on preferences, excluding already viewed
  let relatedProducts = await Product.find({
    design_type: { $in: preferredTypes },
    _id: { $nin: viewedProductIds },
  })
    .populate("shop", "name")
    .limit(Number(limit));

  // If not enough related products, fill with other products
  if (relatedProducts.length < Number(limit)) {
    const additionalProducts = await Product.find({
      _id: {
        $nin: [...viewedProductIds, ...relatedProducts.map((p) => p._id)],
      },
    })
      .populate("shop", "name")
      .limit(Number(limit) - relatedProducts.length)
      .sort({ createdAt: -1 });

    relatedProducts = [...relatedProducts, ...additionalProducts];
  }

  res.status(200).json({
    status: "success",
    length: relatedProducts.length,
    data: relatedProducts,
    userPreferences: preferredTypes,
  });
});
