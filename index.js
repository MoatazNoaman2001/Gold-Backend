import express from "express";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoute.js";
import shopRoutes from "./routes/shopRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import userRoutes from "./routes/userRoute.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import rateRoutes from "./routes/rateRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import dotenv from "dotenv";
import cors from "cors"; // Add CORS import
import session from "express-session";
import passport from "passport";
import oauth20 from "passport-google-oauth20";
import User from "./models/userModel.js";
import { globalErrorHandler } from "./controllers/errorController.js";
import { handleMongooseErrors } from "./utils/wrapperFunction.js";
import { initializeChatSocket } from "./sockets/socketService.js";
import http from "http";

const GoogleAuthStrategy = oauth20.Strategy;

dotenv.config();
const app = express();

// Enable CORS for requests from http://localhost:5174
app.use(
  cors({
    origin: "http://localhost:5175", // Allow your frontend origin
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allow necessary methods
    credentials: true, // Allow cookies and sessions
  })
);

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true if using HTTPS in production
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GoogleAuthStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log(`profile: ${JSON.stringify(profile)}`);
        let user = await User.findOne({ email: profile.emails[0].value });

        if (!user) {
          user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            password: "google-auth-" + Math.random().toString(36).slice(-8),
            role: "user",
            googleId: profile.id,
            isVerified: true,
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
  )
);

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

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.headers.authorization) {
    console.log(
      "Authorization header:",
      req.headers.authorization.substring(0, 20) + "..."
    );
  } else {
    console.log("No authorization header");
  }
  next();
});

app.use("/auth", authRoutes);
app.use("/shop", shopRoutes);
app.use("/product", productRoutes);
app.use("/user", userRoutes);
app.use("/booking", bookingRoutes);
app.use("/rate", rateRoutes);
app.use("/dashboard", dashboardRoutes);

app.use(globalErrorHandler);
app.use(handleMongooseErrors);

const server = http.createServer(app);
initializeChatSocket(server);

// Remove duplicate app.listen
server.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => console.log("MongoDB connection error:", err));

console.log("MONGO_URI:", process.env.MONGO_URI);
console.log("PORT:", process.env.PORT);
