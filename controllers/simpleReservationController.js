import { catchAsync } from '../utils/wrapperFunction.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import SimpleReservation from '../models/simpleReservationModel.js';

// إنشاء حجز جديد مبسط
export const createSimpleReservation = catchAsync(async (req, res) => {
  const { productId, paymentMethodId } = req.body;
  const userId = req.user._id;

  console.log('📝 Creating simple reservation:', {
    productId,
    paymentMethodId,
    userId: userId.toString(),
    userEmail: req.user.email
  });

  // التحقق من وجود المنتج
  const product = await Product.findById(productId);
  if (!product) {
    console.error('❌ Product not found:', productId);
    return res.status(404).json({
      status: 'fail',
      message: 'Product not found'
    });
  }

  console.log('✅ Product found:', {
    productId: product._id,
    productName: product.title || product.name,
    price: product.price,
    shopId: product.shop
  });

  // التحقق من وجود حجز نشط للمنتج من أي مستخدم
  const existingReservation = await SimpleReservation.findOne({
    productId,
    status: { $in: ['active', 'confirmed'] }
  });

  if (existingReservation) {
    console.warn('⚠️ Product already reserved:', {
      productId,
      existingReservationId: existingReservation._id,
      existingUserId: existingReservation.userId,
      currentUserId: userId.toString(),
      reservationStatus: existingReservation.status
    });

    return res.status(400).json({
      status: 'fail',
      message: 'Product is already reserved',
      details: {
        reservationId: existingReservation._id,
        reservedBy: existingReservation.userId.toString() === userId.toString() ? 'you' : 'another_user'
      }
    });
  }

  // حساب المبالغ
  const totalAmount = parseFloat(product.price?.$numberDecimal || product.price || 0);
  const reservationAmount = totalAmount * 0.10; // 10%
  const remainingAmount = totalAmount - reservationAmount;

  console.log('💰 Calculated amounts:', {
    totalAmount: totalAmount.toFixed(2),
    reservationAmount: reservationAmount.toFixed(2),
    remainingAmount: remainingAmount.toFixed(2)
  });

  try {
    // إنشاء الحجز في قاعدة البيانات
    const reservation = await SimpleReservation.create({
      userId,
      productId,
      shopId: product.shop,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      reservationAmount: parseFloat(reservationAmount.toFixed(2)),
      remainingAmount: parseFloat(remainingAmount.toFixed(2)),
      status: 'active',
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 أيام
      paymentMethodId: paymentMethodId
    });

    console.log('✅ Reservation created in database:', {
      reservationId: reservation._id,
      userId: reservation.userId,
      productId: reservation.productId,
      status: reservation.status
    });

    // تحميل البيانات المرتبطة
    await reservation.populate([
      { path: 'productId', select: 'title name logoUrl karat weight price' },
      { path: 'shopId', select: 'name' },
      { path: 'userId', select: 'name email' }
    ]);

    console.log('✅ Reservation populated with related data');

    res.status(201).json({
      status: 'success',
      message: 'Reservation created successfully',
      data: {
        reservation: reservation,
        clientSecret: 'mock_client_secret_for_testing' // محاكاة client secret
      }
    });

  } catch (dbError) {
    console.error('❌ Database error while creating reservation:', {
      error: dbError.message,
      stack: dbError.stack,
      userId: userId.toString(),
      productId
    });

    return res.status(500).json({
      status: 'error',
      message: 'Failed to create reservation in database',
      details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
    });
  }
});

// الحصول على حجوزات المستخدم
export const getUserSimpleReservations = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { status, page = 1, limit = 10 } = req.query;

  console.log('📋 Getting reservations for user:', userId);

  // إعداد فلاتر البحث
  const filters = { userId };
  if (status) {
    filters.status = status;
  }

  // البحث عن حجوزات المستخدم من قاعدة البيانات
  const userReservations = await SimpleReservation.findByUser(userId, filters);

  console.log('📋 Found reservations:', userReservations.length);

  res.status(200).json({
    status: 'success',
    results: userReservations.length,
    data: {
      reservations: userReservations
    }
  });
});

// إلغاء حجز
export const cancelSimpleReservation = catchAsync(async (req, res) => {
  const { reservationId } = req.params;
  const { reason } = req.body;
  const userId = req.user._id;

  console.log('❌ Cancelling reservation:', { reservationId, reason, userId });

  // البحث عن الحجز في قاعدة البيانات
  const reservation = await SimpleReservation.findById(reservationId);

  if (!reservation) {
    return res.status(404).json({
      status: 'fail',
      message: 'Reservation not found'
    });
  }

  if (reservation.userId.toString() !== userId.toString()) {
    return res.status(403).json({
      status: 'fail',
      message: 'Access denied'
    });
  }

  if (reservation.status === 'cancelled') {
    return res.status(400).json({
      status: 'fail',
      message: 'Reservation is already cancelled'
    });
  }

  // تحديث حالة الحجز في قاعدة البيانات
  reservation.status = 'cancelled';
  reservation.cancelationDate = new Date();
  reservation.cancelationReason = reason || 'إلغاء من قبل المستخدم';

  await reservation.save();

  console.log('✅ Reservation cancelled in database:', reservation);

  res.status(200).json({
    status: 'success',
    message: 'Reservation cancelled successfully',
    data: { reservation }
  });
});

// تأكيد الحجز ودفع المبلغ المتبقي
export const confirmSimpleReservation = catchAsync(async (req, res) => {
  const { reservationId } = req.params;
  const { paymentMethodId } = req.body;
  const userId = req.user._id;

  console.log('✅ Confirming reservation:', { reservationId, paymentMethodId, userId });

  // البحث عن الحجز في قاعدة البيانات
  const reservation = await SimpleReservation.findById(reservationId);

  if (!reservation) {
    return res.status(404).json({
      status: 'fail',
      message: 'Reservation not found'
    });
  }

  if (reservation.userId.toString() !== userId.toString()) {
    return res.status(403).json({
      status: 'fail',
      message: 'Access denied'
    });
  }

  if (reservation.status !== 'active') {
    return res.status(400).json({
      status: 'fail',
      message: 'Reservation cannot be confirmed in current status'
    });
  }

  // تحديث حالة الحجز في قاعدة البيانات
  reservation.status = 'confirmed';
  reservation.confirmationDate = new Date();
  reservation.finalPaymentMethodId = paymentMethodId;

  await reservation.save();

  console.log('✅ Reservation confirmed in database:', reservation);

  res.status(200).json({
    status: 'success',
    message: 'Reservation confirmed successfully',
    data: {
      reservation: reservation,
      clientSecret: 'mock_client_secret_for_final_payment'
    }
  });
});

// الحصول على تفاصيل حجز معين
export const getSimpleReservationDetails = catchAsync(async (req, res) => {
  const { reservationId } = req.params;
  const userId = req.user._id;

  console.log('👁️ Getting reservation details:', { reservationId, userId });

  // البحث عن الحجز في قاعدة البيانات مع البيانات المرتبطة
  const reservation = await SimpleReservation.findById(reservationId)
    .populate('productId', 'title name logoUrl karat weight price')
    .populate('shopId', 'name')
    .populate('userId', 'name email');

  if (!reservation) {
    return res.status(404).json({
      status: 'fail',
      message: 'Reservation not found'
    });
  }

  if (reservation.userId._id.toString() !== userId.toString()) {
    return res.status(403).json({
      status: 'fail',
      message: 'Access denied'
    });
  }

  res.status(200).json({
    status: 'success',
    data: { reservation }
  });
});

// الحصول على حجوزات محل معين (للمحل فقط)
export const getShopSimpleReservations = catchAsync(async (req, res) => {
  const { shopId } = req.params;
  const { status, page = 1, limit = 10 } = req.query;

  console.log('🏪 Getting shop reservations:', { shopId });

  // إعداد فلاتر البحث
  const filters = { shopId };
  if (status) {
    filters.status = status;
  }

  // البحث عن حجوزات المحل من قاعدة البيانات
  const shopReservations = await SimpleReservation.findByShop(shopId, filters);

  console.log('🏪 Found shop reservations:', shopReservations.length);

  res.status(200).json({
    status: 'success',
    results: shopReservations.length,
    data: {
      reservations: shopReservations
    }
  });
});

// تحديث حالة الحجز (من قبل المحل)
export const updateSimpleReservationStatus = catchAsync(async (req, res) => {
  const { reservationId } = req.params;
  const { status, notes } = req.body;

  console.log('🔄 Updating reservation status:', { reservationId, status, notes });

  // البحث عن الحجز في قاعدة البيانات
  const reservation = await SimpleReservation.findById(reservationId);

  if (!reservation) {
    return res.status(404).json({
      status: 'fail',
      message: 'Reservation not found'
    });
  }

  // التحقق من صحة تغيير الحالة
  const validStatuses = ['pending', 'active', 'confirmed', 'cancelled', 'expired', 'completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      status: 'fail',
      message: 'Invalid status'
    });
  }

  // تحديث حالة الحجز في قاعدة البيانات
  reservation.status = status;
  if (notes) {
    reservation.shopNotes = notes;
  }

  await reservation.save();

  console.log('✅ Reservation status updated in database:', reservation);

  res.status(200).json({
    status: 'success',
    data: { reservation }
  });
});
