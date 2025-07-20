import { catchAsync } from '../utils/wrapperFunction.js';
import User from '../models/userModel.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { config } from 'dotenv';
import Stripe from 'stripe';
import 'dotenv/config';
import { json } from 'express';


const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const stripe = new Stripe(process.env.STRIPE_SCRETE);

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
export const stripeWebhook = async (req, res) => {
  console.log(`event fired: ${JSON.stringify(req)}`);
  
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
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`, err.message);
      return res.sendStatus(400);
    }
  }
  let subscription;
  let status;
  switch (event.type) {
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