import express from "express";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoute.js";
import shopRoutes from "./routes/shopRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import userRoutes from "./routes/userRoute.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import dotenv from "dotenv";
import rateRoutes from "./routes/rateRoutes.js";

import session from'express-session';
import passport from 'passport';
import oauth20  from 'passport-google-oauth20';
import User from "./models/userModel.js";

let GoogleAuthStratigy = oauth20.Strategy;

dotenv.config();
const app = express();
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleAuthStratigy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL
},
async (accessToken, refreshToken, profile, done) => {
  try {

    console.log(`profile: ${JSON.stringify(profile)}`);
    
    let user = await User.findOne({ email: profile.emails[0].value });

    if (!user) {
      user = new User({
        name: profile.displayName,
        email: profile.emails[0].value,
        password: 'google-auth-' + Math.random().toString(36).slice(-8),
        role: 'user',
        googleId: profile.id,
        isVerified: true
      });
      await user.save();
    } else if (!user.googleId) {
      user.googleId = profile.id;
      await user.save();
    }

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

app.get("/", (req, res) => {
  res.send("Hello, Node.js Project!");
});


app.use("/auth", authRoutes);
app.use("/shop", shopRoutes);
app.use("/product", productRoutes);
app.use("/user", userRoutes);
app.use("/booking", bookingRoutes);
app.use("/rate", rateRoutes);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() =>
    app.listen(process.env.PORT, () =>
      console.log(`Server running on port ${process.env.PORT}`)
    )
  )
  .catch((err) => console.log(err));
console.log("MONGO_URI:", process.env.MONGO_URI);
console.log("PORT:", process.env.PORT);
