import mongoose from 'mongoose';

const simpleReservationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  reservationAmount: {
    type: Number,
    required: true
  },
  remainingAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'confirmed', 'cancelled', 'expired', 'completed'],
    default: 'active'
  },
  reservationDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date,
    required: true
  },
  confirmationDate: {
    type: Date
  },
  cancelationDate: {
    type: Date
  },
  paymentMethodId: {
    type: String,
    required: true
  },
  finalPaymentMethodId: {
    type: String
  },
  stripeSessionId: {
    type: String
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'RESERVATION_PAID', 'FULLY_PAID', 'FAILED'],
    default: 'PENDING'
  },
  cancelationReason: {
    type: String
  },
  shopNotes: {
    type: String
  },
  metadata: {
    type: Map,
    of: String,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

simpleReservationSchema.index({ userId: 1, status: 1 });
simpleReservationSchema.index({ shopId: 1, status: 1 });
simpleReservationSchema.index({ productId: 1, status: 1 });
simpleReservationSchema.index({ expiryDate: 1 });

simpleReservationSchema.virtual('product', {
  ref: 'Product',
  localField: 'productId',
  foreignField: '_id',
  justOne: true
});

simpleReservationSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

simpleReservationSchema.virtual('shop', {
  ref: 'Shop',
  localField: 'shopId',
  foreignField: '_id',
  justOne: true
});

simpleReservationSchema.methods.isExpired = function() {
  return new Date() > this.expiryDate;
};

simpleReservationSchema.methods.getDaysRemaining = function() {
  const now = new Date();
  const diffTime = this.expiryDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

simpleReservationSchema.statics.findExpired = function() {
  return this.find({
    status: 'active',
    expiryDate: { $lt: new Date() }
  });
};

simpleReservationSchema.statics.findByUser = function(userId, filters = {}) {
  return this.find({ userId, ...filters })
    .populate('productId', 'title name logoUrl karat weight price')
    .populate('shopId', 'name')
    .sort({ createdAt: -1 });
};

simpleReservationSchema.statics.findByShop = function(shopId, filters = {}) {
  return this.find({ shopId, ...filters })
    .populate('productId', 'title name logoUrl karat weight price')
    .populate('userId', 'name email')
    .sort({ createdAt: -1 });
};

simpleReservationSchema.pre('save', function(next) {
  if (this.status === 'active' && this.isExpired()) {
    this.status = 'expired';
  }
  next();
});

const SimpleReservation = mongoose.model('SimpleReservation', simpleReservationSchema);

export default SimpleReservation;
