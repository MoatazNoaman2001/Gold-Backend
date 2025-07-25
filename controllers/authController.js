import { catchAsync } from '../utils/wrapperFunction.js';
import User from '../models/userModel.js';
import SimpleReservation from '../models/simpleReservationModel.js';
import Product from '../models/productModel.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { config } from 'dotenv';
import Stripe from 'stripe';
import 'dotenv/config';
import { json } from 'express';


const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const stripe = new Stripe(process.env.STRIPE_SECRET);

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: "1h",
    }
  );

  const refreshToken = jwt.sign(
    {
      id: user._id,
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "15d" }
  );

  return { refreshToken, accessToken };
};

export const register = catchAsync(async (req, res) => {
  const { name, email, phone, password, role, paid } = req.body;

  const existingUser = await User.findOne({ email });
  
  if (existingUser) {
    return res.status(400).json({ message: "User already exists" });
  }

  const user = new User({
    name,
    email,
    phone,
    password,
    role,
    paid: role === 'seller' ? (paid ?? false) : undefined,
  });

  await user.save();

  res.status(201).json({ message: "User created successfully" });
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(422).json({
      status: "fail",
      message: "Please provide email and password",
    });
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    return res.status(401).json({
      status: "fail",
      message: "Invalid email",
    });
  }

  const isValid = await user.comparePassword(password);
  if (!isValid) {
    return res.status(401).json({
      status: "fail",
      message: "Invalid password",
    });
  }

  const { accessToken, refreshToken } = generateTokens(user);
  user.refreshToken = refreshToken;
  await user.save();

  res.cookie("jwt", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 15 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    status: "success",
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      paid: user.paid
    },
  });
});

export const refresh = catchAsync(async (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) {
    return res.status(401).json({ 
      status: "fail",
      message: "No refresh token provided" 
    });
  }

  const refreshToken = cookies.jwt;

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(403).json({ 
        status: "fail",
        message: "User not found" 
      });
    }

    if (!user.refreshToken || user.refreshToken !== refreshToken) {
      return res.status(403).json({ 
        status: "fail",
        message: "Invalid refresh token" 
      });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    user.refreshToken = newRefreshToken;
    await user.save();

    res.cookie("jwt", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 15 * 24 * 60 * 60 * 1000,
    });

    res.json({ 
      status: "success",
      accessToken 
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        status: "fail",
        message: "Invalid refresh token" 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        status: "fail",
        message: "Refresh token expired" 
      });
    }
    throw error;
  }
});

export const logout = catchAsync(async (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) {
    return res.sendStatus(204);
  }

  const refreshToken = cookies.jwt;

  const user = await User.findOne({ refreshToken });

  if (user) {
    user.refreshToken = null;
    await user.save();
  }

  res.clearCookie("jwt", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
  });

  res.status(200).json({ 
    status: "success",
    message: "Logged out successfully" 
  });
});

export const googleAuthFailure = (req, res) => {
  res.status(401).json({
    status: "fail",
    message: "Google authentication failed",
  });
};

export const googleAuth = async (req, res) => {
  try {
    const { credential, role, paid } = req.body;

    if (!credential) {
      return res.status(400).json({ 
        status: "fail",
        message: 'ID token is required' 
      });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, sub: googleId, name, picture } = payload;
    
    let user = await User.findOne({ email: email });
    let isNewUser = false;
  
    if (!user) {
      user = await User.create({
        name,
        email,
        role: role,
        googleId,
        paid: role === 'seller' ? (paid ?? false) : undefined,
      });
      isNewUser = true;
    } else if (user.googleId && user.googleId !== googleId) {
      return res.status(400).json({
        status: "fail",
        message: "Email already registered with different method"
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    user.refreshToken = refreshToken;
    await user.save();
    
    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 15 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      status: "success",
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
      isNewUser
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ 
      status: "fail",
      message: 'Google authentication failed' 
    });
  }
}; 

export const createPaymentSession = async (req, res) => {
  const {priceId} = req.body;
  try {
    // const paymentIntent = await stripe.paymentIntents.create({
    //   amount: amount,
    //   currency: "usd"
    // });
    // res.json({clientSecret: paymentIntent.client_secret})

    await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: 'http://localhost:5173/success?sessions_id={}'
    })
  }catch (err) {
    res.status(500).json({error: err.message})
  }
}

export const createCheckoutSession = async (req, res) => {
  try {
    const prices = await stripe.prices.list({
      lookup_keys: [req.body.lookup_key],
      expand: ['data.product'],
    });
    const session = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [
        {
          price: prices.data[0].id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.YOUR_DOMAIN}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.YOUR_DOMAIN}?canceled=true`,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const createPortalSession = async (req, res) => {
  try {
    const { productId, email } = req.body;

    // Validate required fields
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    console.log('Creating checkout session for:', { productId, email });

    const sessionConfig = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: productId,
          quantity: 1
        }
      ],
      success_url: `${process.env.FRONT_END_DOMAIN}:${process.env.FRONT_END_PORT}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONT_END_DOMAIN}:${process.env.FRONT_END_PORT}/owner-payment`
    };

    // Add customer email if provided
    if (email) {
      sessionConfig.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log('Checkout session created:', session.url);

    // Return the checkout URL
    return res.status(200).json(session.url);
  } catch (err) {
    console.error('Error creating checkout session:', err);
    res.status(500).json({ error: err.message });
  }
};

// إنشاء جلسة دفع للحجوزات
export const createReservationPaymentSession = async (req, res) => {
  try {
    const { productId, reservationAmount, email, productName } = req.body;

    // Validate required fields
    if (!productId || !reservationAmount) {
      return res.status(400).json({ error: 'Product ID and reservation amount are required' });
    }

    console.log('Creating reservation payment session for:', { productId, reservationAmount, email, productName });

    const sessionConfig = {
      mode: 'payment', // دفعة واحدة وليس اشتراك
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'egp',
            product_data: {
              name: `حجز منتج: ${productName || 'منتج ذهبي'}`,
              description: `دفع 10% لحجز المنتج لمدة 7 أيام`,
              metadata: {
                type: 'reservation',
                productId: productId
              }
            },
            unit_amount: Math.round(reservationAmount * 100), // تحويل إلى قروش
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONT_END_DOMAIN}:${process.env.FRONT_END_PORT}/reservation-success?session_id={CHECKOUT_SESSION_ID}&product_id=${productId}`,
      cancel_url: `${process.env.FRONT_END_DOMAIN}:${process.env.FRONT_END_PORT}/reservation-payment`,
      metadata: {
        type: 'reservation',
        productId: productId,
        reservationAmount: reservationAmount.toString()
      }
    };

    // Add customer email if provided
    if (email) {
      sessionConfig.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log('Reservation payment session created:', session.url);

    // Return the checkout URL
    return res.status(200).json(session.url);
  } catch (err) {
    console.error('Error creating reservation payment session:', err);
    res.status(500).json({ error: err.message });
  }
};
// حذف الحجز مع إعادة تعيين حالة المنتج
// الحصول على حجوزات المستخدم بدون authentication (للاختبار)
export const getUserReservationsPublic = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email is required'
      });
    }

    console.log('📋 Getting reservations for email:', email);

    // البحث عن المستخدم
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    // البحث عن حجوزات المستخدم
    const reservations = await SimpleReservation.find({ userId: user._id })
      .populate('productId', 'title name logoUrl karat weight price description')
      .populate('shopId', 'name')
      .sort({ createdAt: -1 });

    console.log('📋 Found reservations:', reservations.length);

    res.status(200).json({
      status: 'success',
      results: reservations.length,
      data: {
        reservations
      }
    });

  } catch (error) {
    console.error('❌ Error getting user reservations:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

export const deleteReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;

    console.log('🗑️ Deleting reservation:', reservationId);

    // البحث عن الحجز
    const reservation = await SimpleReservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        status: 'fail',
        message: 'Reservation not found'
      });
    }

    // إعادة تعيين حالة المنتج إلى متاح
    const product = await Product.findById(reservation.productId);
    if (product) {
      product.isAvailable = true;
      await product.save();
      console.log('✅ Product availability reset to true');
    }

    // حذف الحجز
    await SimpleReservation.findByIdAndDelete(reservationId);
    console.log('✅ Reservation deleted successfully');

    res.status(200).json({
      status: 'success',
      message: 'Reservation deleted and product availability reset'
    });

  } catch (error) {
    console.error('❌ Error deleting reservation:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

export const stripeWebhook = async (req, res) => {
  console.log(`🔔 Stripe webhook event received`);

  let event = req.body;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (endpointSecret) {
    const signature = req.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        endpointSecret
      );
      console.log(`✅ Webhook signature verified for event: ${event.type}`);
    } catch (err) {
      console.log(`❌ Webhook signature verification failed:`, err.message);
      return res.sendStatus(400);
    }
  }
  let subscription;
  let status;
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('🎉 Checkout session completed:', session.id);

      // التحقق من نوع الدفع من metadata
      if (session.metadata?.type === 'reservation') {
        await handleReservationCheckoutCompleted(session);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      subscription = event.data.object;
      status = subscription.status;
      console.log(`Subscription status is ${status}.`);
      // Only mark as paid if status is active
      if (status === 'active' && subscription.customer) {
        // Retrieve the customer to get the email
        const customer = await stripe.customers.retrieve(subscription.customer);
        const email = customer.email;
        if (email) {
          // Find seller user by email and set paid=true
          const user = await User.findOne({ email, role: 'seller' });
          if (user && !user.paid) {
            user.paid = true;
            await user.save();
            console.log(`Set paid=true for seller user ${email}`);
          }
        }
      }
      break;
    }
    case 'customer.subscription.trial_will_end':
    case 'customer.subscription.deleted':
      subscription = event.data.object;
      status = subscription.status;
      console.log(`Subscription status is ${status}.`);
      break;
    case 'entitlements.active_entitlement_summary.updated':
      subscription = event.data.object;
      console.log(`Active entitlement summary updated for ${subscription}.`);
      break;
    default:
      console.log(`Unhandled event type ${event.type}.`);
  }
  res.send();
};

export const sellerPaidUpdate = async (req, res) =>{ 
  try{
    const {email} = req.body
    if (email){
      const user = await User.findOneAndUpdate({email: email} , {paid: true})
      return res.status(200).json({message:"success updated", user: user})
    }
    return res.status(402).json({message: "not found"});
  }catch(err) {
    return res.status(400).json({message: `error happen: ${JSON.stringify(err)}`})
  }
}

// التحقق من حالة الدفع للحجوزات وإنشاء الحجز إذا لم يكن موجوداً (يتطلب authentication)
export const verifyReservationPayment = async (req, res) => {
  try {
    const { sessionId, productId } = req.body;
    const userId = req.user._id;

    console.log('🔍 Verifying reservation payment:', { sessionId, productId, userId });

    if (!sessionId || !productId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Session ID and Product ID are required'
      });
    }

    // التحقق من جلسة Stripe
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
      console.log('💳 Stripe session retrieved:', {
        id: session.id,
        payment_status: session.payment_status,
        metadata: session.metadata
      });
    } catch (stripeError) {
      console.error('❌ Error retrieving Stripe session:', stripeError);
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid session ID'
      });
    }

    // التحقق من حالة الدفع
    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        status: 'fail',
        message: 'Payment not completed'
      });
    }

    // البحث عن حجز موجود مسبقاً
    const existingReservation = await SimpleReservation.findOne({
      stripeSessionId: sessionId
    }).populate([
      { path: 'productId', select: 'title name logoUrl karat weight price description' },
      { path: 'shopId', select: 'name' },
      { path: 'userId', select: 'name email' }
    ]);

    if (existingReservation) {
      console.log('✅ Found existing reservation:', existingReservation._id);
      return res.status(200).json({
        status: 'success',
        message: 'Reservation already exists',
        data: {
          reservation: existingReservation
        }
      });
    }

    // البحث عن المنتج
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found'
      });
    }

    // التحقق من أن المنتج متاح للحجز
    if (!product.isAvailable) {
      return res.status(400).json({
        status: 'fail',
        message: 'Product is not available for reservation'
      });
    }

    // حساب مبالغ الحجز
    const totalAmount = parseFloat(product.price);
    const reservationAmount = totalAmount * 0.1; // 10%
    const remainingAmount = totalAmount - reservationAmount;

    // إنشاء الحجز الجديد
    const reservation = new SimpleReservation({
      userId: userId,
      productId: productId,
      shopId: product.shop, // تصحيح: استخدام product.shop بدلاً من product.shopId
      totalAmount: totalAmount,
      reservationAmount: reservationAmount,
      remainingAmount: remainingAmount,
      status: 'active', // تصحيح: استخدام 'active' بدلاً من 'ACTIVE'
      reservationDate: new Date(),
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 أيام
      stripeSessionId: sessionId,
      paymentStatus: 'RESERVATION_PAID'
    });

    try {
      await reservation.save();
      console.log('✅ Reservation saved successfully:', reservation._id);

      // تحديث حالة المنتج إلى غير متاح
      product.isAvailable = false;
      await product.save();
      console.log('✅ Product availability updated');
    } catch (saveError) {
      console.error('❌ Error saving reservation:', saveError);
      throw new Error(`Failed to save reservation: ${saveError.message}`);
    }

    // تحميل البيانات المرتبطة
    await reservation.populate([
      { path: 'productId', select: 'title name logoUrl karat weight price description' },
      { path: 'shopId', select: 'name' },
      { path: 'userId', select: 'name email' }
    ]);

    console.log('✅ Reservation populated with data:', {
      reservationId: reservation._id,
      productData: reservation.productId,
      shopData: reservation.shopId,
      userData: reservation.userId
    });

    console.log('✅ New reservation created after payment verification:', reservation._id);

    res.status(201).json({
      status: 'success',
      message: 'Reservation created successfully after payment verification',
      data: {
        reservation: reservation
      }
    });

  } catch (error) {
    console.error('❌ Error in verifyReservationPayment:', {
      error: error.message,
      stack: error.stack,
      sessionId: req.body.sessionId,
      productId: req.body.productId,
      userId: req.user._id.toString()
    });

    res.status(500).json({
      status: 'error',
      message: 'Internal server error during payment verification',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// التحقق من حالة الدفع للحجوزات بدون authentication (للاستخدام بعد العودة من Stripe)
export const verifyReservationPaymentPublic = async (req, res) => {
  try {
    const { sessionId, productId } = req.body;

    console.log('🔍 Public verification of reservation payment:', { sessionId, productId });

    if (!sessionId || !productId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Session ID and Product ID are required'
      });
    }

    // البحث عن حجز موجود مسبقاً (إما بـ sessionId أو بـ productId + user email)
    let existingReservation = await SimpleReservation.findOne({
      stripeSessionId: sessionId
    }).populate([
      { path: 'productId', select: 'title name logoUrl karat weight price description' },
      { path: 'shopId', select: 'name' },
      { path: 'userId', select: 'name email' }
    ]);

    if (existingReservation) {
      console.log('✅ Found existing reservation by sessionId:', existingReservation._id);
      return res.status(200).json({
        status: 'success',
        message: 'Reservation found',
        data: {
          reservation: existingReservation
        }
      });
    }

    // إذا لم نجد الحجز بـ sessionId، نبحث بـ productId (في حالة تم إنشاؤه عبر webhook)
    // أولاً نحتاج للحصول على email المستخدم من Stripe session
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
      console.log('💳 Stripe session retrieved for user lookup:', {
        id: session.id,
        payment_status: session.payment_status,
        customer_email: session.customer_details?.email
      });
    } catch (stripeError) {
      console.error('❌ Error retrieving Stripe session:', stripeError);
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid session ID'
      });
    }

    const customerEmail = session.customer_details?.email;
    if (customerEmail) {
      const user = await User.findOne({ email: customerEmail });
      if (user) {
        // البحث عن حجز للمستخدم والمنتج
        existingReservation = await SimpleReservation.findOne({
          userId: user._id,
          productId: productId,
          status: { $in: ['active', 'confirmed'] }
        }).populate([
          { path: 'productId', select: 'title name logoUrl karat weight price description' },
          { path: 'shopId', select: 'name' },
          { path: 'userId', select: 'name email' }
        ]);

        if (existingReservation) {
          console.log('✅ Found existing reservation by user and product:', existingReservation._id);
          return res.status(200).json({
            status: 'success',
            message: 'Reservation found',
            data: {
              reservation: existingReservation
            }
          });
        }
      }
    }

    // إذا لم نجد حجز موجود، نتحقق من حالة الدفع
    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        status: 'fail',
        message: 'Payment not completed'
      });
    }

    // التحقق من وجود email المستخدم
    if (!customerEmail) {
      return res.status(400).json({
        status: 'fail',
        message: 'Customer email not found in payment session'
      });
    }

    const user = await User.findOne({ email: customerEmail });
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found with the email from payment session'
      });
    }

    // البحث عن المنتج
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found'
      });
    }

    // التحقق من أن المنتج متاح للحجز
    // أولاً نتحقق من وجود حجوزات نشطة للمنتج
    const activeReservationForProduct = await SimpleReservation.findOne({
      productId: productId,
      status: { $in: ['active', 'confirmed'] }
    });

    if (activeReservationForProduct) {
      return res.status(400).json({
        status: 'fail',
        message: 'Product is already reserved by another user'
      });
    }

    // إذا لم توجد حجوزات نشطة، نتأكد من أن المنتج متاح
    if (!product.isAvailable) {
      // إعادة تعيين حالة المنتج إذا لم توجد حجوزات نشطة
      product.isAvailable = true;
      await product.save();
      console.log('✅ Product availability reset to true (no active reservations found)');
    }

    // حساب مبالغ الحجز
    const totalAmount = parseFloat(product.price);
    const reservationAmount = totalAmount * 0.1; // 10%
    const remainingAmount = totalAmount - reservationAmount;

    // إنشاء الحجز الجديد
    const reservation = new SimpleReservation({
      userId: user._id,
      productId: productId,
      shopId: product.shop, // تصحيح: استخدام product.shop بدلاً من product.shopId
      totalAmount: totalAmount,
      reservationAmount: reservationAmount,
      remainingAmount: remainingAmount,
      status: 'active', // تصحيح: استخدام 'active' بدلاً من 'ACTIVE'
      reservationDate: new Date(),
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 أيام
      stripeSessionId: sessionId,
      paymentMethodId: sessionId, // استخدام sessionId كـ paymentMethodId
      paymentStatus: 'RESERVATION_PAID'
    });

    try {
      await reservation.save();
      console.log('✅ Reservation saved successfully:', reservation._id);

      // تحديث حالة المنتج إلى غير متاح
      product.isAvailable = false;
      await product.save();
      console.log('✅ Product availability updated');

      // تحميل البيانات المرتبطة
      await reservation.populate([
        { path: 'productId', select: 'title name logoUrl karat weight price description' },
        { path: 'shopId', select: 'name' },
        { path: 'userId', select: 'name email' }
      ]);
      console.log('✅ Reservation populated with related data');
    } catch (saveError) {
      console.error('❌ Error saving reservation or updating product:', saveError);
      throw new Error(`Failed to save reservation: ${saveError.message}`);
    }

    console.log('✅ Public reservation created successfully:', reservation._id);

    res.status(201).json({
      status: 'success',
      message: 'Reservation created successfully',
      data: {
        reservation: reservation
      }
    });

  } catch (error) {
    console.error('❌ Error in verifyReservationPaymentPublic:', {
      error: error.message,
      stack: error.stack,
      sessionId: req.body.sessionId,
      productId: req.body.productId
    });

    res.status(500).json({
      status: 'error',
      message: 'Internal server error during payment verification',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// معالجة إكمال جلسة الدفع للحجوزات
const handleReservationCheckoutCompleted = async (session) => {
  try {
    const { productId, reservationAmount } = session.metadata;
    const customerEmail = session.customer_details?.email;

    console.log('🔄 Processing reservation checkout completion:', {
      sessionId: session.id,
      productId,
      customerEmail,
      paymentStatus: session.payment_status
    });

    if (session.payment_status !== 'paid') {
      console.log('⚠️ Payment not completed, skipping reservation creation');
      return;
    }

    // البحث عن المستخدم بالإيميل
    const user = await User.findOne({ email: customerEmail });
    if (!user) {
      console.error('❌ User not found for email:', customerEmail);
      return;
    }

    // التحقق من وجود حجز موجود
    const existingReservation = await SimpleReservation.findOne({
      productId,
      userId: user._id,
      status: { $in: ['active', 'confirmed'] }
    });

    if (existingReservation) {
      console.log('✅ Reservation already exists:', existingReservation._id);
      return;
    }

    // الحصول على تفاصيل المنتج
    const product = await Product.findById(productId);
    if (!product) {
      console.error('❌ Product not found:', productId);
      return;
    }

    // حساب المبالغ
    const totalAmount = parseFloat(product.price?.$numberDecimal || product.price || 0);
    const calculatedReservationAmount = totalAmount * 0.10; // 10%
    const remainingAmount = totalAmount - calculatedReservationAmount;

    // إنشاء الحجز
    const reservation = await SimpleReservation.create({
      userId: user._id,
      productId,
      shopId: product.shop,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      reservationAmount: parseFloat(calculatedReservationAmount.toFixed(2)),
      remainingAmount: parseFloat(remainingAmount.toFixed(2)),
      status: 'active',
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 أيام
      paymentMethodId: session.id // استخدام session ID
    });

    console.log('✅ Reservation created via webhook:', reservation._id);

  } catch (error) {
    console.error('❌ Error in handleReservationCheckoutCompleted:', error);
  }
};

export const paymentSuccess = async (req, res) => {
  try {
    const { email, sessionId } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Optionally verify the session with Stripe
    if (sessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') {
          return res.status(400).json({ error: 'Payment not completed' });
        }
      } catch (stripeError) {
        console.error('Error verifying Stripe session:', stripeError);
        // Continue anyway - webhook should handle the payment confirmation
      }
    }

    // Update user payment status
    const user = await User.findOneAndUpdate(
      { email: email, role: 'seller' },
      { paid: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'Seller user not found' });
    }

    return res.status(200).json({ 
      message: "Payment status updated successfully", 
      user: user 
    });
  } catch (err) {
    console.error('Payment success error:', err);
    return res.status(500).json({ 
      error: `Error updating payment status: ${err.message}` 
    });
  }
};