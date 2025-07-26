import Rating from '../models/ratingModel.js';
import Product from '../models/productModel.js';
import { catchAsync } from '../utils/wrapperFunction.js';

/**
 * @desc    Rate a product
 * @route   POST /product/:id/rate
 * @access  Private (Authenticated users only)
 */
export const rateProduct = catchAsync(async (req, res) => {
  const { id: productId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user._id;

  // Validate input
  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return res.status(400).json({
      status: 'error',
      message: 'Rating must be a whole number between 1 and 5'
    });
  }

  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({
      status: 'error',
      message: 'Product not found'
    });
  }

  // Check if user already rated this product
  let existingRating = await Rating.findOne({ userId, productId });

  if (existingRating) {
    // Update existing rating
    existingRating.rating = rating;
    existingRating.comment = comment || existingRating.comment;
    await existingRating.save();

    // Populate user data
    await existingRating.populate('userId', 'name email');

    console.log(` User ${userId} updated rating for product ${productId}`);

    return res.status(200).json({
      status: 'success',
      message: 'Rating updated successfully',
      data: {
        rating: existingRating
      }
    });
  } else {
    // Create new rating
    const newRating = await Rating.create({
      userId,
      productId,
      rating,
      comment: comment || ''
    });

    // Populate user data
    await newRating.populate('userId', 'name email');

    console.log(` User ${userId} rated product ${productId} with ${rating} stars`);

    return res.status(201).json({
      status: 'success',
      message: 'Rating created successfully',
      data: {
        rating: newRating
      }
    });
  }
});

/**
 * @desc    Get all ratings for a product
 * @route   GET /product/:id/ratings
 * @access  Public
 */
export const getProductRatings = catchAsync(async (req, res) => {
  const { id: productId } = req.params;
  const { page = 1, limit = 10, sort = 'newest' } = req.query;

  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({
      status: 'error',
      message: 'Product not found'
    });
  }

  // Determine sort order
  let sortOption = { createdAt: -1 }; // Default: newest first
  if (sort === 'oldest') {
    sortOption = { createdAt: 1 };
  } else if (sort === 'highest') {
    sortOption = { rating: -1, createdAt: -1 };
  } else if (sort === 'lowest') {
    sortOption = { rating: 1, createdAt: -1 };
  }

  // Get ratings with pagination
  const ratings = await Rating.find({ productId })
    .populate('userId', 'name email')
    .sort(sortOption)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Get total count
  const totalRatings = await Rating.countDocuments({ productId });

  // Get rating statistics
  const stats = await Rating.calculateProductStats(productId);

  console.log(` Retrieved ${ratings.length} ratings for product ${productId}`);

  res.status(200).json({
    status: 'success',
    results: ratings.length,
    data: {
      ratings,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalRatings,
        pages: Math.ceil(totalRatings / limit)
      }
    }
  });
});

/**
 * @desc    Get user's rating for a specific product
 * @route   GET /product/:id/my-rating
 * @access  Private
 */
export const getUserRating = catchAsync(async (req, res) => {
  const { id: productId } = req.params;
  const userId = req.user._id;

  const rating = await Rating.findOne({ userId, productId })
    .populate('userId', 'name email');

  if (!rating) {
    return res.status(404).json({
      status: 'error',
      message: 'No rating found for this product'
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      rating
    }
  });
});

/**
 * @desc    Delete user's rating for a product
 * @route   DELETE /product/:id/rate
 * @access  Private
 */
export const deleteRating = catchAsync(async (req, res) => {
  const { id: productId } = req.params;
  const userId = req.user._id;

  const rating = await Rating.findOne({ userId, productId });

  if (!rating) {
    return res.status(404).json({
      status: 'error',
      message: 'No rating found to delete'
    });
  }

  await rating.remove();

  console.log(` User ${userId} deleted rating for product ${productId}`);

  res.status(200).json({
    status: 'success',
    message: 'Rating deleted successfully'
  });
});

/**
 * @desc    Get rating statistics for a product
 * @route   GET /product/:id/rating-stats
 * @access  Public
 */
export const getRatingStats = catchAsync(async (req, res) => {
  const { id: productId } = req.params;

  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({
      status: 'error',
      message: 'Product not found'
    });
  }

  const stats = await Rating.calculateProductStats(productId);

  res.status(200).json({
    status: 'success',
    data: {
      stats
    }
  });
});
