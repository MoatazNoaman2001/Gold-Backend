import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import Shop from '../models/shopModel.js';
export const authenticateUser = async (req, res, next) => {
  let token;
  if (req.headers.authorization) {
    if (req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else {
      token = req.headers.authorization;
    }
  }
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }
};


export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthError('User not authenticated.');
      }
      if (!allowedRoles.includes(req.user.role)) {
        throw new AuthError('Insufficient permissions to access this resource.', 403);
      }
      next();
    } catch (error) {
      handleAuthError(error, res);
    }
  };
};



export const verifyShopOwnership = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AuthError('User not authenticated.');
    }

    const { _id: userId, role } = req.user;

    // Only sellers can be shop owners
    if (role !== 'seller') {
      throw new AuthError('Access denied. Only sellers can access shop resources.', 403);
    }

    // Find shops owned by the user
    const sellerShops = await Shop.find({ owner: userId }).populate('owner', 'name email');

    if (!sellerShops || sellerShops.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'No shops found for this seller. Please create a shop first.',
      });
    }

    // Attach shops to request object for use in subsequent middleware/controllers
    req.shops = sellerShops;
    req.shopIds = sellerShops.map(shop => shop._id);

    console.log(`Seller ${userId} accessing ${sellerShops.length} shop(s)`);

    next();
  } catch (error) {
    console.error('Error in verifyShopOwnership:', error);

    if (error instanceof AuthError) {
      handleAuthError(error, res);
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Server error while verifying shop ownership',
      });
    }
  }
};