import { catchAsync } from '../utils/wrapperFunction.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import SimpleReservation from '../models/simpleReservationModel.js';

export const createSimpleReservation = catchAsync(async (req, res) => {
  const { productId, paymentMethodId } = req.body;
  const userId = req.user._id;

  console.log(' Creating simple reservation:', {
    productId,
    paymentMethodId,
    userId: userId.toString(),
    userEmail: req.user.email
  });

  const product = await Product.findById(productId);
  if (!product) {
    console.error(' Product not found:', productId);
    return res.status(404).json({
      status: 'fail',
      message: 'Product not found'
    });
  }

  console.log('Product found:', {
    productId: product._id,
    productName: product.title || product.name,
    price: product.price,
    shopId: product.shop
  });

  const existingReservation = await SimpleReservation.findOne({
    productId,
    status: { $in: ['active', 'confirmed'] }
  });

  if (existingReservation) {
    console.warn(' Product already reserved:', {
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

  const totalAmount = parseFloat(product.price?.$numberDecimal || product.price || 0);
  const reservationAmount = totalAmount * 0.10; // 10%
  const remainingAmount = totalAmount - reservationAmount;

  console.log(' Calculated amounts:', {
    totalAmount: totalAmount.toFixed(2),
    reservationAmount: reservationAmount.toFixed(2),
    remainingAmount: remainingAmount.toFixed(2)
  });

  try {
    const reservation = await SimpleReservation.create({
      userId,
      productId,
      shopId: product.shop,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      reservationAmount: parseFloat(reservationAmount.toFixed(2)),
      remainingAmount: parseFloat(remainingAmount.toFixed(2)),
      status: 'active',
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
      paymentMethodId: paymentMethodId
    });

    console.log(' Reservation created in database:', {
      reservationId: reservation._id,
      userId: reservation.userId,
      productId: reservation.productId,
      status: reservation.status
    });

    await reservation.populate([
      { path: 'productId', select: 'title name logoUrl karat weight price' },
      { path: 'shopId', select: 'name' },
      { path: 'userId', select: 'name email' }
    ]);

    console.log('Reservation populated with related data');

    res.status(201).json({
      status: 'success',
      message: 'Reservation created successfully',
      data: {
        reservation: reservation,
        clientSecret: 'mock_client_secret_for_testing'
      }
    });

  } catch (dbError) {
    console.error(' Database error while creating reservation:', {
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

export const getUserSimpleReservations = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { status, page = 1, limit = 10 } = req.query;

  console.log('Getting reservations for user:', userId);

  const filters = { userId };
  if (status) {
    filters.status = status;
  }

  const userReservations = await SimpleReservation.findByUser(userId, filters);

  console.log('Found reservations:', userReservations.length);

  res.status(200).json({
    status: 'success',
    results: userReservations.length,
    data: {
      reservations: userReservations
    }
  });
});

export const cancelSimpleReservation = catchAsync(async (req, res) => {
  const { reservationId } = req.params;
  const { reason } = req.body;
  const userId = req.user._id;

  console.log(' Cancelling reservation:', { reservationId, reason, userId });

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

  reservation.status = 'cancelled';
  reservation.cancelationDate = new Date();
  reservation.cancelationReason = reason || 'إلغاء من قبل المستخدم';

  await reservation.save();

  console.log(' Reservation cancelled in database:', reservation);

  res.status(200).json({
    status: 'success',
    message: 'Reservation cancelled successfully',
    data: { reservation }
  });
});

export const confirmSimpleReservation = catchAsync(async (req, res) => {
  const { reservationId } = req.params;
  const { paymentMethodId } = req.body;
  const userId = req.user._id;

  console.log(' Confirming reservation:', { reservationId, paymentMethodId, userId });

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

  reservation.status = 'confirmed';
  reservation.confirmationDate = new Date();
  reservation.finalPaymentMethodId = paymentMethodId;

  await reservation.save();

  console.log(' Reservation confirmed in database:', reservation);

  res.status(200).json({
    status: 'success',
    message: 'Reservation confirmed successfully',
    data: {
      reservation: reservation,
      clientSecret: 'mock_client_secret_for_final_payment'
    }
  });
});

export const getSimpleReservationDetails = catchAsync(async (req, res) => {
  const { reservationId } = req.params;
  const userId = req.user._id;

  console.log(' Getting reservation details:', { reservationId, userId });

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

export const getShopSimpleReservations = catchAsync(async (req, res) => {
  const { shopId } = req.params;
  const { status, page = 1, limit = 10 } = req.query;

  console.log(' Getting shop reservations:', { shopId });

  const filters = { shopId };
  if (status) {
    filters.status = status;
  }

  const shopReservations = await SimpleReservation.findByShop(shopId, filters);

  console.log(' Found shop reservations:', shopReservations.length);

  res.status(200).json({
    status: 'success',
    results: shopReservations.length,
    data: {
      reservations: shopReservations
    }
  });
});

export const updateSimpleReservationStatus = catchAsync(async (req, res) => {
  const { reservationId } = req.params;
  const { status, notes } = req.body;

  console.log('Updating reservation status:', { reservationId, status, notes });

  const reservation = await SimpleReservation.findById(reservationId);

  if (!reservation) {
    return res.status(404).json({
      status: 'fail',
      message: 'Reservation not found'
    });
  }

  const validStatuses = ['pending', 'active', 'confirmed', 'cancelled', 'expired', 'completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      status: 'fail',
      message: 'Invalid status'
    });
  }

  reservation.status = status;
  if (notes) {
    reservation.shopNotes = notes;
  }

  await reservation.save();

  console.log(' Reservation status updated in database:', reservation);

  res.status(200).json({
    status: 'success',
    data: { reservation }
  });
});
