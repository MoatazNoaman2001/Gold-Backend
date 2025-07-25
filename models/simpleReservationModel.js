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
  // المبالغ
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
  // حالة الحجز
  status: {
    type: String,
    enum: ['pending', 'active', 'confirmed', 'cancelled', 'expired', 'completed'],
    default: 'active'
  },
  // التواريخ
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
  // معلومات الدفع
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
  // ملاحظات
  cancelationReason: {
    type: String
  },
  shopNotes: {
    type: String
  },
  // معلومات إضافية
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

// إضافة indexes للبحث السريع
simpleReservationSchema.index({ userId: 1, status: 1 });
simpleReservationSchema.index({ shopId: 1, status: 1 });
simpleReservationSchema.index({ productId: 1, status: 1 });
simpleReservationSchema.index({ expiryDate: 1 });

// Virtual للحصول على معلومات المنتج
simpleReservationSchema.virtual('product', {
  ref: 'Product',
  localField: 'productId',
  foreignField: '_id',
  justOne: true
});

// Virtual للحصول على معلومات المستخدم
simpleReservationSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual للحصول على معلومات المحل
simpleReservationSchema.virtual('shop', {
  ref: 'Shop',
  localField: 'shopId',
  foreignField: '_id',
  justOne: true
});

// Method للتحقق من انتهاء صلاحية الحجز
simpleReservationSchema.methods.isExpired = function() {
  return new Date() > this.expiryDate;
};

// Method لحساب الأيام المتبقية
simpleReservationSchema.methods.getDaysRemaining = function() {
  const now = new Date();
  const diffTime = this.expiryDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

// Static method للبحث عن الحجوزات المنتهية الصلاحية
simpleReservationSchema.statics.findExpired = function() {
  return this.find({
    status: 'active',
    expiryDate: { $lt: new Date() }
  });
};

// Static method للبحث عن حجوزات المستخدم
simpleReservationSchema.statics.findByUser = function(userId, filters = {}) {
  return this.find({ userId, ...filters })
    .populate('productId', 'title name logoUrl karat weight price')
    .populate('shopId', 'name')
    .sort({ createdAt: -1 });
};

// Static method للبحث عن حجوزات المحل
simpleReservationSchema.statics.findByShop = function(shopId, filters = {}) {
  return this.find({ shopId, ...filters })
    .populate('productId', 'title name logoUrl karat weight price')
    .populate('userId', 'name email')
    .sort({ createdAt: -1 });
};

// Pre-save middleware لتحديث حالة الحجوزات المنتهية الصلاحية
simpleReservationSchema.pre('save', function(next) {
  if (this.status === 'active' && this.isExpired()) {
    this.status = 'expired';
  }
  next();
});

const SimpleReservation = mongoose.model('SimpleReservation', simpleReservationSchema);

export default SimpleReservation;
