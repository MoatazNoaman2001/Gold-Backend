import { catchAsync } from "../utils/wrapperFunction.js";
import Shop from "../models/shopModel.js";
import multer from "multer";
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/shop-images/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  console.log(JSON.stringify(file));
  
  const filetypes = /jpeg|jpg|png/;
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

export const createShop = async (req, res) => {
  try {
    const { logo, images } = req.files || {};
    const shopData = {
      ...req.body,
      owner: req.user._id,
      logoUrl: logo ? `${logo[0].filename}` : undefined,
      images: images ? images.map(file => `${file.filename}`) : [],
    };

    const newShop = await Shop.create(shopData);
    res.status(201).json({
      status: "success",
      data: newShop,
    });
  } catch (error) {
    console.error(`Error creating shop: ${error}`);
    res.status(500).json({
      status: "error",
      message: "Failed to create shop",
    });
  }
};

export const getAllShops = catchAsync(async (req, res) => {
  // 1) Parse query parameters
  const { location, rating, specialties, sortBy } = req.query;
  
  // 2) Initialize base query conditions
  let filter = {};
  let sortOption = '-createdAt'; // Default sort by newest

  // 3) Apply role-based filtering
  if (req.user.role === "seller") {
    filter.owner = req.user._id;
    
    // Location filter (search in city, area, or address)
    if (location) {
      filter.$or = [
        { city: new RegExp(location, 'i') },
        { area: new RegExp(location, 'i') },
        { address: new RegExp(location, 'i') }
      ];
    }
    
    // Rating filter
    if (rating) {
      filter.averageRating = { $gte: Number(rating) };
    }
    
    // Specialties filter - "like" search instead of exact match
    if (specialties) {
      const specialtiesArray = Array.isArray(specialties) 
        ? specialties 
        : specialties.split(',');

      // Create an array of regex conditions for each specialty
      const regexConditions = specialtiesArray.map(specialty => ({
        specialties: { 
          $regex: specialty.trim(), 
          $options: 'i' // case insensitive
        }
      }));
    
      // Use $or to match any of the specialties
      filter.$or = regexConditions;
    }
    // Sorting
    if (sortBy) {
      sortOption = sortBy;
    }
  } 
  else if (req.user.role === "admin") {
    // Admins can see all shops without filters
  } 
  else {
    // Regular users only see approved shops
    filter.isApproved = true;
    
    // Optional: Apply public filters for regular users
    if (location) {
      filter.$or = [
        { city: new RegExp(location, 'i') },
        { area: new RegExp(location, 'i') }
      ];
    }

    // Specialties filter - "like" search instead of exact match
    if (specialties) {
      const specialtiesArray = Array.isArray(specialties) 
        ? specialties 
        : specialties.split(',');
      
      // Create an array of regex conditions for each specialty
      const regexConditions = specialtiesArray.map(specialty => ({
        specialties: { 
          $regex: specialty.trim(), 
          $options: 'i' // case insensitive
        }
      }));
    
      // Use $or to match any of the specialties
      filter.$or = regexConditions;
    }
  }

  // 4) Execute the query
  let shops = await Shop.find(filter)
    .populate("owner", "name email")
    .sort(sortOption);

  // 5) Apply default values and transformations
  const shopsWithDefaults = shops.map((shop) => {
    const shopObj = shop.toObject();
    
    return {
      ...shopObj,
      address: shopObj.address || 
               `${shopObj.area ? shopObj.area + ', ' : ''}${shopObj.city || 'القاهرة'}, مصر`,
      phone: shopObj.phone || shopObj.whatsapp || "01000000000",
      specialties: shopObj.specialties?.length ? shopObj.specialties : ["مجوهرات", "ذهب"],
      workingHours: shopObj.workingHours || "9:00 ص - 9:00 م",
      rating: shopObj.rating || shopObj.averageRating || 4.5,
      reviewCount: shopObj.reviewCount || 10,
      description: shopObj.description || "متجر مجوهرات وذهب عالي الجودة",
      // Calculate subscription status for frontend
      isPremium: ['Premium', 'Gold'].includes(shopObj.subscriptionPlan),
      isVerified: shopObj.isApproved && shopObj.reviewCount > 5
    };
  });

  // 6) Send response
  res.status(200).json({
    status: "success",
    results: shopsWithDefaults.length,
    data: shopsWithDefaults
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
  const updatedShop = await Shop.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  }).populate("owner", "name email");
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

// Public endpoint to get approved shops without authentication
export const getPublicShops = catchAsync(async (req, res) => {
  // Only return approved shops for public viewing
  const shops = await Shop.find({ isApproved: true }).populate(
    "owner",
    "name email"
  );

  // Add default values for missing fields
  const shopsWithDefaults = shops.map((shop) => {
    const shopObj = shop.toObject();
    return {
      ...shopObj,
      address:
        shopObj.address || shopObj.area || shopObj.city || "القاهرة، مصر",
      phone: shopObj.phone || shopObj.whatsapp || "01000000000",
      specialties: shopObj.specialties || ["مجوهرات", "ذهب"],
      workingHours: shopObj.workingHours || "9:00 ص - 9:00 م",
      rating: shopObj.rating || shopObj.averageRating || 4.5,
      reviewCount: shopObj.reviewCount || 10,
      description: shopObj.description || "متجر مجوهرات وذهب عالي الجودة",
    };
  });

  res.status(200).json({
    status: "success",
    result: shopsWithDefaults.length,
    data: shopsWithDefaults,
  });
});

// Public endpoint to get a specific shop without authentication
export const getPublicShop = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Only return the shop if it's approved
  const shop = await Shop.findOne({
    _id: id,
    isApproved: true,
  }).populate("owner", "name email");

  if (!shop) {
    return res.status(404).json({
      status: "fail",
      message: "Shop not found or not approved",
    });
  }

  res.status(200).json({
    status: "success",
    data: shop,
  });
});
