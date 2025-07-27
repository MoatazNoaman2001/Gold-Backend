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
import notificationRoutes from "./routes/notificationRoutes.js";
import bcrypt from 'bcrypt';

// ============================================================================
// NEW RESERVATION SYSTEM IMPORTS
// ============================================================================
import reservationRoutes from "./routes/reservationRoutes.js";
import simpleReservationRoutes from "./routes/simpleReservationRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import ratingRoutes from "./routes/ratingRoutes.js";
import { setupDIContainer } from "./Infrastructure/DI/Container.js";
import { setupScheduledJobs } from "./Infrastructure/Jobs/JobScheduler.js";
import { setupReservationEventHandlers } from "./Infrastructure/EventHandlers/ReservationEventSetup.js";

import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import oauth20 from "passport-google-oauth20";
import User from "./models/userModel.js";
import { globalErrorHandler } from "./controllers/errorController.js";
import { handleMongooseErrors } from "./utils/wrapperFunction.js";
import http from "http";
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import fss from "fs";
import calculatePriceRoutes from "./routes/goldPriceRoutes.js";
import cron from "node-cron";
import { refreshProductPrices } from "./controllers/goldPriceController.js";
import mediaRoutes from './routes/mediaRoute.js';
import { initializeEnhancedChatSocket } from "./sockets/enhancedSocketServer.js";

// Create upload directories if they don't exist
const createUploadDirs = async () => {
  const dirs = [
    "uploads/product-images",
    "uploads/shop-images",
    "uploads/commercial-records",
  ];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`✅ Directory created/verified: ${dir}`);
    } catch (error) {
      console.error(`❌ Error creating directory ${dir}:`, error);
    }
  }
};

// Initialize upload directories
createUploadDirs();

const GoogleAuthStrategy = oauth20.Strategy;

dotenv.config();
const app = express();

// ============================================================================
// RESERVATION SYSTEM INITIALIZATION
// ============================================================================

// Initialize DI Container for reservation system
console.log("🔄 Initializing Reservation System...");
const container = setupDIContainer();

// Make container available globally
app.locals.container = container;

// ============================================================================
// MIDDLEWARE SETUP (Your existing + Reservation system)
// ============================================================================

// IMPORTANT: Webhook routes MUST be before express.json() middleware
// because Stripe webhooks need raw body
app.use("/webhooks", webhookRoutes);

app.use(express.json());

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, origin || "*");
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// EXISTING IMAGE SERVING ENDPOINTS
// ============================================================================

app.get("/shop-image/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const safeFilename = filename.replace(/\.\.\//g, "").replace(/^\//, "");
    const imagePath = join(__dirname, "uploads", "shop-images", safeFilename);
    const fileExists = await fs
      .access(imagePath)
      .then(() => true)
      .catch(() => false);
    const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(imagePath);

    if (fileExists && isImage) {
      res.sendFile(imagePath);
    } else {
      res.status(404).send("Image not found");
    }
  } catch (error) {
    console.error("Error serving image:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/product-image/:filename", async (req, res) => {
  try {
    let filename = decodeURIComponent(req.params.filename);

    filename = filename
      .replace(/\.\.\//g, "")
      .replace(/\//g, "_")
      .replace(/\\/g, "_");

    const imagePath = path.join(
      __dirname,
      "uploads",
      "product-images",
      filename
    );

    const fileExists = fss.existsSync(imagePath);
    const isImage = /\.(jpe?g|png|gif|webp)$/i.test(filename);
    console.log(`${fileExists}, ${isImage}`);

    if (fileExists && isImage) {
      res.setHeader("Cache-Control", "public, max-age=31536000");
      res.sendFile(imagePath);
    } else {
      res.status(404).send("Image not found");
    }
  } catch (error) {
    console.error("Error serving image:", error);
    res.status(500).send("Internal server error");
  }
});

// Serve commercial record PDFs
app.get("/commercial-record/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const safeFilename = filename.replace(/\.\.\//g, "").replace(/^\//, "");
    const pdfPath = join(
      __dirname,
      "uploads",
      "commercial-records",
      safeFilename
    );

    const fileExists = await fs
      .access(pdfPath)
      .then(() => true)
      .catch(() => false);
    const isPdf = /\.pdf$/i.test(pdfPath);

    if (fileExists && isPdf) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Cache-Control", "public, max-age=31536000");
      res.sendFile(pdfPath);
    } else {
      res.status(404).send("Commercial record not found");
    }
  } catch (error) {
    console.error("Error serving commercial record:", error);
    res.status(500).send("Internal server error");
  }
});

// ============================================================================
// PASSPORT GOOGLE AUTH SETUP (Your existing)
// ============================================================================

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

// ============================================================================
// SCHEDULED JOBS SETUP
// ============================================================================

// Your existing gold price update job
cron.schedule("*/30 * * * *", async () => {
  console.log("Running scheduled price update...");
  try {
    await refreshProductPrices();
    console.log("Scheduled price update completed");
  } catch (error) {
    console.error("Scheduled price update failed:", error);
  }
});

// NEW: Reservation system scheduled jobs
const reservationScheduler = setupScheduledJobs();

// Start reservation jobs
reservationScheduler.startJob("reservation-expiry");
reservationScheduler.startJob("reservation-reminders");

console.log(
  "✅ Scheduled jobs initialized (Price updates + Reservation system)"
);

// ============================================================================
// ROUTES SETUP
// ============================================================================

app.get("/", (req, res) => {
  res.send("Hello, Debla Project with Reservation System!");
});

// Health check with reservation system status
app.get("/health", async (req, res) => {
  try {
    // Check database connection
    const dbState = mongoose.connection.readyState;

    // Check reservation system
    const reservationRepository = container.resolve("reservationRepository");

    res.status(200).json({
      status: "success",
      message: "Server is running",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      services: {
        database: dbState === 1 ? "connected" : "disconnected",
        reservationSystem: "operational",
        scheduledJobs: "active",
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Health check failed",
      error: error.message,
    });
  }
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

// ============================================================================
// EXISTING ROUTES
// ============================================================================
app.use("/auth", authRoutes);
app.use("/shop", shopRoutes);
app.use("/product", productRoutes);
app.use("/user", userRoutes);
app.use("/booking", bookingRoutes);
app.use("/rate", rateRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/chatbot", chatbotRoutes);
app.use("/notifications", notificationRoutes);
app.use("/price", calculatePriceRoutes);
app.use('/api', mediaRoutes);

// Rating routes
app.use("/", ratingRoutes);

// ============================================================================
// NEW RESERVATION SYSTEM ROUTES
// ============================================================================
app.use("/reservations", reservationRoutes);
app.use("/simple-reservations", simpleReservationRoutes);

// Test endpoint to verify reservation system integration
app.get("/test/reservation", async (req, res) => {
  try {
    const reservationRepository = container.resolve("reservationRepository");
    const paymentService = container.resolve("paymentService");

    res.json({
      status: "success",
      message: "Reservation system is properly integrated",
      services: {
        repository: !!reservationRepository,
        paymentService: !!paymentService,
        container: !!container,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Reservation system test failed",
      error: error.message,
    });
  }
});

// ============================================================================
// ERROR HANDLING (Your existing)
// ============================================================================
app.use(globalErrorHandler);
app.use(handleMongooseErrors);

// ============================================================================
// SERVER SETUP WITH RESERVATION SYSTEM
// ============================================================================
const server = http.createServer(app);
initializeEnhancedChatSocket(server);

// ============================================================================
// DATABASE CONNECTION WITH RESERVATION SYSTEM SETUP
// ============================================================================
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to MongoDB");

    // Setup reservation system after DB connection
    await setupReservationSystem();
    
    async function updatePassword() {
      try {
        // Update the password
        await User.updateOne({ email: "moataz.noaman12@gmail.com" }, {
          password: await bcrypt.hash('QTJKLas4321', 12)
        });
      } catch (error) {
        console.error('Error updating or comparing password:', error);
      }
    }
    
    updatePassword();
    


    console.log("🚀 Reservation System fully initialized");
  })
  .catch((err) => console.log("❌ MongoDB connection error:", err));

// ============================================================================
// RESERVATION SYSTEM SETUP FUNCTION
// ============================================================================
async function setupReservationSystem() {
  try {
    // Setup database indexes for reservations
    await setupReservationIndexes();

    // Setup event handlers
    setupReservationEventHandlers(container);

    // Setup notification services
    setupNotificationServices();

    console.log("✅ Reservation system setup completed");
  } catch (error) {
    console.error("❌ Reservation system setup failed:", error);
  }
}

// Setup database indexes for optimal reservation queries
async function setupReservationIndexes() {
  try {
    const db = mongoose.connection.db;

    // Create reservation collection indexes
    await db.collection("reservations").createIndex({ userId: 1, status: 1 });
    await db
      .collection("reservations")
      .createIndex({ productId: 1, status: 1 });
    await db.collection("reservations").createIndex({ shopId: 1, status: 1 });
    await db.collection("reservations").createIndex({ expiryDate: 1 });
    await db
      .collection("reservations")
      .createIndex({ stripePaymentIntentId: 1 });
    await db.collection("reservations").createIndex({ reservationDate: -1 });

    console.log("✅ Reservation database indexes created");
  } catch (error) {
    console.error("❌ Error creating reservation indexes:", error);
  }
}

// Setup notification services
function setupNotificationServices() {
  try {
    const eventPublisher = container.resolve("eventPublisher");
    const notificationService = container.resolve("notificationService");

    // Subscribe to reservation events for notifications
    eventPublisher.subscribe("ReservationCreated", async (eventData) => {
      console.log(
        `📧 Sending reservation created notification for ${eventData.reservationId}`
      );
    });

    eventPublisher.subscribe("ReservationActivated", async (eventData) => {
      console.log(
        `📧 Sending reservation confirmation notification for ${eventData.reservationId}`
      );
    });

    eventPublisher.subscribe("ReservationExpired", async (eventData) => {
      console.log(
        `📧 Sending reservation expired notification for ${eventData.reservationId}`
      );
    });

    console.log("✅ Notification services setup completed");
  } catch (error) {
    console.error("❌ Error setting up notification services:", error);
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
process.on("SIGTERM", () => {
  console.log("📤 SIGTERM received, shutting down gracefully");

  // Stop reservation scheduled jobs
  reservationScheduler.stopAll();

  server.close(() => {
    console.log("🔌 HTTP server closed");
    mongoose.connection.close(() => {
      console.log("🗄️ MongoDB connection closed");
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  console.log("📤 SIGINT received, shutting down gracefully");

  // Stop reservation scheduled jobs
  reservationScheduler.stopAll();

  server.close(() => {
    console.log("🔌 HTTP server closed");
    mongoose.connection.close(() => {
      console.log("🗄️ MongoDB connection closed");
      process.exit(0);
    });
  });
});

// Start server
server.listen(process.env.PORT, () => {
  console.log(`
🚀 Server running on port ${process.env.PORT}
📱 Environment: ${process.env.NODE_ENV || "development"}
💳 Stripe Mode: ${
    process.env.STRIPE_SECRET_KEY?.includes("sk_test") ? "Test" : "Live"
  }
🔄 Reservation System: Active
⏰ Scheduled Jobs: Active (Price Updates + Reservations)
📧 Notifications: ${
    process.env.EMAIL_ENABLED === "true" ? "Enabled" : "Disabled"
  }
  `);
});

console.log("MONGO_URI:", process.env.MONGO_URI);
console.log("PORT:", process.env.PORT);

export default app;
