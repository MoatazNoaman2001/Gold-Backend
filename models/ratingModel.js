import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    validate: {
      validator: function(value) {
        return Number.isInteger(value);
      },
      message: 'Rating must be a whole number'
    }
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  isVerifiedPurchase: {
    type: Boolean,
    default: false
  },
  helpfulVotes: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index to ensure one rating per user per product
ratingSchema.index({ userId: 1, productId: 1 }, { unique: true });

// Index for efficient queries
ratingSchema.index({ productId: 1, createdAt: -1 });
ratingSchema.index({ rating: 1 });

// Virtual for formatted date
ratingSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Static method to calculate product rating statistics
ratingSchema.statics.calculateProductStats = async function(productId) {
  const stats = await this.aggregate([
    {
      $match: { 
        productId: new mongoose.Types.ObjectId(productId)
      }
    },
    {
      $group: {
        _id: '$productId',
        numRatings: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);

  if (stats.length > 0) {
    const stat = stats[0];
    
    // Calculate rating distribution
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stat.ratingDistribution.forEach(rating => {
      distribution[rating]++;
    });

    return {
      numRatings: stat.numRatings,
      averageRating: Math.round(stat.averageRating * 10) / 10, // Round to 1 decimal
      ratingDistribution: distribution
    };
  }

  return {
    numRatings: 0,
    averageRating: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  };
};

// Static method to update product rating
ratingSchema.statics.updateProductRating = async function(productId) {
  try {
    const Product = mongoose.model('Product');
    const stats = await this.calculateProductStats(productId);
    
    await Product.findByIdAndUpdate(productId, {
      numRatings: stats.numRatings,
      averageRating: stats.averageRating,
      ratingDistribution: stats.ratingDistribution
    });
    
    console.log(`Updated product ${productId} rating stats:`, stats);
  } catch (error) {
    console.error(' Error updating product rating:', error);
  }
};

// Post-save middleware to update product statistics
ratingSchema.post('save', async function() {
  await this.constructor.updateProductRating(this.productId);
});

// Post-remove middleware to update product statistics
ratingSchema.post('remove', async function() {
  await this.constructor.updateProductRating(this.productId);
});

const Rating = mongoose.model('Rating', ratingSchema);

export default Rating;
