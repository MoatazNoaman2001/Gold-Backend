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
      logoUrl: logo ? `/uploads/shop-images/${logo[0].filename}` : undefined,
      images: images ? images.map(file => `/uploads/shop-images/${file.filename}`) : [],
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
  let shops;

  // إذا كان المستخدم بائع، أظهر متاجره فقط
  if (req.user.role === "seller") {
    shops = await Shop.find({ owner: req.user._id }).populate(
      "owner",
      "name email"
    );
  }
  // إذا كان أدمن، أظهر جميع المتاجر
  else if (req.user.role === "admin") {
    shops = await Shop.find().populate("owner", "name email");
  }
  // إذا كان عميل، أظهر المتاجر المُوافق عليها فقط
  else {
    shops = await Shop.find({ isApproved: true }).populate(
      "owner",
      "name email"
    );
  }

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
