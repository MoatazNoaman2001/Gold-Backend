
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import Shop from '../models/shopModel.js';


export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization) {
    if (req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else {
      token = req.headers.authorization;
    }
  }
  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
  try {
    console.log(`token: ${token}`);
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    req.user = user;
    next();
  } catch (err) {
    console.log(`error: ${err}`);

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Not authorized, invalid token" });
  }
};
export const authenticateUser = async (req, res, next) => {

  let token;
  if (req.headers.authorization) {
    if (req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else {
      token = req.headers.authorization;
    }
  }
  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
  try {
    console.log(`token: ${token}`);
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    req.user = user;
    next();
  } catch (err) {
    console.log(`error: ${err}`);

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Not authorized, invalid token" });
  }
};

// Role-based access control
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action",
      });
    }

    next();
  };
};


export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "fail",
          message: "User not authenticated.",
        });
      }
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          status: "fail",
          message: "Insufficient permissions to access this resource.",
        });
      }
      next();
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Server error during authorization.",
      });
    }
  };
};

// Middleware للتأكد من أن المستخدم أدمن
export const requireAdmin = (req, res, next) => {
  console.log(
    "requireAdmin middleware - checking user:",
    req.user
      ? {
          id: req.user._id,
          email: req.user.email,
          role: req.user.role,
        }
      : "No user found"
  );

  if (!req.user) {
    console.log("requireAdmin: User not authenticated");
    return res.status(401).json({
      status: "fail",
      message: "User not authenticated.",
    });
  }
  if (req.user.role !== "admin") {
    console.log(`requireAdmin: User role is ${req.user.role}, not admin`);
    return res.status(403).json({
      status: "fail",
      message: "Admin access required.",
    });
  }
  console.log("requireAdmin: Admin access granted");
  next();
};

// Middleware للتأكد من أن المستخدم بائع (بدون شرط الدفع)
export const requireSeller = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "fail",
      message: "User not authenticated.",
    });
  }
  if (req.user.role !== "seller") {
    return res.status(403).json({
      status: "fail",
      message: "Seller access required.",
    });
  }
  next();
};

// Middleware للتأكد من أن البائع دفع الاشتراك (للعمليات التي تتطلب دفع)
export const requirePaidSeller = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "fail",
      message: "User not authenticated.",
    });
  }
  if (req.user.role !== "seller") {
    return res.status(403).json({
      status: "fail",
      message: "Seller access required.",
    });
  }
  if (!req.user.paid) {
    return res.status(403).json({
      status: "fail",
      message: "Payment required. Please complete your subscription payment.",
    });
  }
  next();
};

// Middleware للتأكد من أن المتجر معتمد من الأدمن
export const requireApprovedShop = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: "fail",
        message: "User not authenticated.",
      });
    }
    if (req.user.role !== "seller") {
      return res.status(403).json({
        status: "fail",
        message: "Seller access required.",
      });
    }

    const shop = await Shop.findOne({ owner: req.user._id });
    if (!shop) {
      return res.status(404).json({
        status: "fail",
        message: "No shop found. Please create a shop first.",
      });
    }

    if (shop.requestStatus !== "approved") {
      return res.status(403).json({
        status: "fail",
        message: "Shop approval required. Please wait for admin approval.",
      });
    }

    req.shop = shop;
    next();
  } catch (error) {
    console.error("Error in requireApprovedShop:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while checking shop approval status",
    });
  }
};

// Middleware للتأكد من أن البائع معتمد ومدفوع (للمنتجات)
export const requireApprovedAndPaidSeller = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: "fail",
        message: "User not authenticated.",
      });
    }

    if (req.user.role !== "seller") {
      return res.status(403).json({
        status: "fail",
        message: "Seller access required.",
      });
    }

    // التحقق من الدفع
    if (!req.user.paid) {
      return res.status(403).json({
        status: "fail",
        message: "Payment required. Please complete your subscription payment to manage products.",
        code: "PAYMENT_REQUIRED"
      });
    }

    // التحقق من وجود المتجر وموافقة الأدمن
    const shop = await Shop.findOne({ owner: req.user._id });
    if (!shop) {
      return res.status(404).json({
        status: "fail",
        message: "No shop found. Please create a shop first.",
        code: "NO_SHOP"
      });
    }

    if (shop.requestStatus !== "approved") {
      return res.status(403).json({
        status: "fail",
        message: "Shop approval required. Please wait for admin approval before managing products.",
        code: "SHOP_NOT_APPROVED",
        shopStatus: shop.requestStatus,
        rejectionReason: shop.rejectionReason || null
      });
    }

    req.shop = shop;
    next();
  } catch (error) {
    console.error("Error in requireApprovedAndPaidSeller:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while checking seller permissions",
    });
  }
};

// Middleware للتأكد من أن المستخدم عميل
export const requireCustomer = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "fail",
      message: "User not authenticated.",
    });
  }
  if (req.user.role !== "customer") {
    return res.status(403).json({
      status: "fail",
      message: "Customer access required.",
    });
  }
  next();
};

export const verifyShopOwnership = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AuthError("User not authenticated.");
    }

    const { _id: userId, role } = req.user;

    // Only sellers can be shop owners
    if (role !== "seller") {
      throw new AuthError(
        "Access denied. Only sellers can access shop resources.",
        403
      );
    }

    // Find shops owned by the user
    const sellerShops = await Shop.find({ owner: userId }).populate(
      "owner",
      "name email"
    );

    if (!sellerShops || sellerShops.length === 0) {
      return res.status(404).json({
        status: "fail",
        message: "No shops found for this seller. Please create a shop first.",
      });
    }

    // Attach shops to request object for use in subsequent middleware/controllers
    req.shops = sellerShops;
    req.shopIds = sellerShops.map((shop) => shop._id);

    console.log(`Seller ${userId} accessing ${sellerShops.length} shop(s)`);

    next();
  } catch (error) {
    console.error("Error in verifyShopOwnership:", error);

    if (error instanceof AuthError) {
      handleAuthError(error, res);
    } else {
      res.status(500).json({
        status: "error",
        message: "Server error while verifying shop ownership",
      });
    }
  }
};
