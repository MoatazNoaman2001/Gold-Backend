import { catchAsync } from "../utils/wrapperFunction.js";
import Shop from "../models/shopModel.js";
import multer from "multer";
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'commercialRecord') {
      cb(null, 'uploads/commercial-records/');
    } else {
      cb(null, 'uploads/shop-images/');
    }
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
  const imageTypes = /jpeg|jpg|png|webp/;
  const pdfType = /pdf/;

  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (file.fieldname === "commercialRecord") {
    if (pdfType.test(ext) && mime === "application/pdf") {
      return cb(null, true);
    } else {
      return cb(new Error("فقط ملفات PDF مسموحة للسجل التجاري"));
    }
  }

  if (file.fieldname === "logo" || file.fieldname === "images") {
    if (imageTypes.test(ext) && imageTypes.test(mime)) {
      return cb(null, true);
    } else {
      return cb(new Error("فقط الصور مسموحة (jpeg, jpg, png, webp)"));
    }
  }

  cb(new Error("ملف غير مدعوم"));
};

export const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter,
}).fields([
  { name: "logo", maxCount: 1 },
  { name: "images", maxCount: 10 },
  { name: "commercialRecord", maxCount: 1 },
]);

//  function to delete uploaded files
const deleteUploadedFiles = (files) => {
  if (!files) return;
  Object.values(files).flat().forEach(file => {
    fs.unlink(file.path, (err) => {
      if (err) console.error(`❌ Error deleting file: ${file.path}`, err);
      else console.log(`🗑️ Deleted file: ${file.path}`);
    });
  });
};

export const createShop = async (req, res) => {
  try {
    const existingShop = await Shop.findOne({ owner: req.user._id });
    if (existingShop) {
      deleteUploadedFiles(req.files);
      return res.status(400).json({
        status: 'error',
        message: 'لديك محل بالفعل، لا يمكنك إنشاء محل آخر',
      });
    }

    if (!req.files || !req.files.logo || !req.files.commercialRecord) {
      deleteUploadedFiles(req.files);
      return res.status(400).json({
        status: "error",
        message: "يرجى تحميل الشعار والصور والسجل التجاري",
      });
    }

    if (!req.body.name) {
      deleteUploadedFiles(req.files);
      return res.status(400).json({
        status: "error",
        message: "الاسم مطلوب",
      });
    }

    if (!req.body.location) {
      deleteUploadedFiles(req.files);
      return res.status(400).json({
        status: "error",
        message: "الموقع مطلوب",
      });
    }

    const { logo, images, commercialRecord } = req.files;

    let locationData = null;
    try {
      locationData = JSON.parse(req.body.location);
    } catch (error) {
      deleteUploadedFiles(req.files);
      return res.status(400).json({ status: "error", message: "الموقع غير صالح" });
    }

    const shopData = {
      ...req.body,
      owner: req.user._id,
      logoUrl: logo[0].filename,
      images: images ? images.map(file => file.filename) : [],
      commercialRecord: commercialRecord[0].filename,
      location: locationData,
      requestStatus: "pending", // المتجر يبدأ بحالة انتظار الموافقة
      isApproved: false, // غير معتمد حتى موافقة الأدمن
    };

    const newShop = await Shop.create(shopData);

    res.status(201).json({
      status: "success",
      message: "Shop created successfully. Please wait for admin approval before requesting activation.",
      data: newShop,
    });
  } catch (error) {
    console.error(`❌ Error creating shop: ${error}`);
    deleteUploadedFiles(req.files);
    res.status(500).json({
      status: "error",
      message: "حدث خطأ أثناء إنشاء المحل",
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
      rating: shopObj.averageRating || shopObj.rating || 0,
      averageRating: shopObj.averageRating || shopObj.rating || 0,
      reviewCount: shopObj.reviewCount || 0,
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

  let updateData = { ...req.body };

  // Handle location parsing
  if (req.body.location && typeof req.body.location === 'string') {
    try {
      updateData.location = JSON.parse(req.body.location);
    } catch (error) {
      console.error('Error parsing location data:', error);
    }
  }

  // Handle uploaded files
  const { logo, images, commercialRecord } = req.files || {};

  if (logo) {
    updateData.logoUrl = logo[0].filename;
  }

  if (images) {
    updateData.images = images.map(file => file.filename);
  }

  if (commercialRecord) {
    updateData.commercialRecord = commercialRecord[0].filename;
  }

  const updatedShop = await Shop.findByIdAndUpdate(id, updateData, {
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

// Generate QR Code for a shop
export const generateShopQRCode = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Find the shop and verify ownership
  const shop = await Shop.findById(id);

  if (!shop) {
    return res.status(404).json({
      status: "fail",
      message: "Shop not found",
    });
  }

  // Check if user owns this shop (for shop owners) or is admin
  if (req.user.role !== "admin" && shop.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      status: "fail",
      message: "You don't have permission to generate QR code for this shop",
    });
  }

  try {
    // Create the shop URL that the QR code will point to
    const frontendBaseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:5173";
    const shopUrl = `${frontendBaseUrl}/shops/${shop._id}`;

    // Generate QR code as base64 data URL
    const qrCodeDataUrl = await QRCode.toDataURL(shopUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });

    // Update shop with QR code data
    shop.qrCode = qrCodeDataUrl;
    shop.qrCodeUrl = shopUrl;
    await shop.save();

    res.status(200).json({
      status: "success",
      message: "QR Code generated successfully",
      data: {
        qrCode: qrCodeDataUrl,
        qrCodeUrl: shopUrl,
        shopId: shop._id,
        shopName: shop.name
      },
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to generate QR code",
    });
  }
});

// Get QR Code for a shop
export const getShopQRCode = catchAsync(async (req, res) => {
  const { id } = req.params;

  const shop = await Shop.findById(id).select('qrCode qrCodeUrl name owner');

  if (!shop) {
    return res.status(404).json({
      status: "fail",
      message: "Shop not found",
    });
  }

  // Check if user owns this shop (for shop owners) or is admin
  if (req.user.role !== "admin" && shop.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      status: "fail",
      message: "You don't have permission to access QR code for this shop",
    });
  }

  // If QR code doesn't exist, generate it
  if (!shop.qrCode) {
    try {
      const frontendBaseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:5173";
      const shopUrl = `${frontendBaseUrl}/shops/${shop._id}`;

      const qrCodeDataUrl = await QRCode.toDataURL(shopUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });

      shop.qrCode = qrCodeDataUrl;
      shop.qrCodeUrl = shopUrl;
      await shop.save();
    } catch (error) {
      console.error("Error generating QR code:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to generate QR code",
      });
    }
  }

  res.status(200).json({
    status: "success",
    data: {
      qrCode: shop.qrCode,
      qrCodeUrl: shop.qrCodeUrl,
      shopId: shop._id,
      shopName: shop.name
    },
  });
});
