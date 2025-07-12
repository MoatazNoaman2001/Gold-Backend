import express from "express";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoute.js";
import shopRoutes from "./routes/shopRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import userRoutes from "./routes/userRoute.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import rateRoutes from "./routes/rateRoutes.js";

import dashboardRoutes from "./routes/dashboardRoutes.js";
import chatbotRoutes from "./routes/chatbotRoutes.js";
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
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from 'fs/promises';
import fss from 'fs';


const GoogleAuthStrategy = oauth20.Strategy;

dotenv.config();
const app = express();

// Enable CORS for requests from frontend
app.use(
  cors({

    origin: ["http://localhost:5173"], // Allow both frontend ports
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"], // Allow necessary methods
    credentials: true, // Allow cookies and sessions
  })
);

app.use(express.json());
app.use(cors({
  origin: (origin, callback) => {
    callback(null, origin || '*');
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.get('/shop-image/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const safeFilename = filename.replace(/\.\.\//g, '').replace(/^\//, '');
    const imagePath = join(__dirname, 'uploads', 'shop-images', safeFilename);
    const fileExists = await fs.access(imagePath).then(() => true).catch(() => false);
    const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(imagePath);
    
    if (fileExists && isImage) {
      res.sendFile(imagePath);
    } else {
      res.status(404).send('Image not found');
    }
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).send('Internal server error');
  }
});


app.get('/product-image/:filename', async (req, res) => {
  try {
    // 1. Decode the URL-encoded filename
    let filename = decodeURIComponent(req.params.filename);
    
    // 2. Additional security: replace any remaining problematic characters
    filename = filename.replace(/\.\.\//g, '')     // Prevent directory traversal
                      .replace(/\//g, '_')        // Replace slashes
                      .replace(/\\/g, '_');       // Replace backslashes
    
    // 3. Construct the full path
    const imagePath = path.join(__dirname, 'uploads', 'product-images', filename);
    
    // 4. Check if file exists and is an image
    const fileExists = fss.existsSync(imagePath);
    const isImage = /\.(jpe?g|png|gif|webp)$/i.test(filename);
    console.log(`${fileExists}, ${isImage}`);
    
    if (fileExists && isImage) {
      // Optional: Set caching headers
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.sendFile(imagePath);
    } else {
      res.status(404).send('Image not found');
    }
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).send('Internal server error');
  }
});

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
            role: "customer",
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
  res.send("Hello, Debla Project!");
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
app.use("/chatbot", chatbotRoutes);

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
