import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { Message, Conversation } from "../models/chatModel.js";
import {
  SOCKET_SECURITY_CONFIG,
  sanitizeInput,
  RateLimiter,
  SecurityLogger,
  ConnectionMonitor
} from "../utils/socketSecurity.js";
import { validateMediaFile, generateThumbnail } from "../utils/mediaUtils.js";
import multer from "multer";
import path from "path";
import fs from "fs";

let io;
const rateLimiter = new RateLimiter();
const connectionMonitor = new ConnectionMonitor();

// Media configuration
const MEDIA_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'],
  ALLOWED_AUDIO_TYPES: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm'],
  MAX_AUDIO_DURATION: 300, // 5 minutes in seconds
  MAX_VIDEO_DURATION: 600, // 10 minutes in seconds
};

// Configure multer for handling file uploads in memory
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: MEDIA_CONFIG.MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      ...MEDIA_CONFIG.ALLOWED_IMAGE_TYPES,
      ...MEDIA_CONFIG.ALLOWED_VIDEO_TYPES,
      ...MEDIA_CONFIG.ALLOWED_AUDIO_TYPES
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  }
});

function checkRateLimit(userId, action) {
  const limits = {
    'createShopConversation': { max: 10, window: 60000 },
    'createConversation': { max: 10, window: 60000 },
    'sendMessage': { max: 50, window: 60000 },
    'sendMediaMessage': { max: 20, window: 60000 }, // New rate limit for media
    'joinConversation': { max: 20, window: 60000 },
    'getMessages': { max: 100, window: 60000 },
    'markAsRead': { max: 100, window: 60000 },
    'sendTypingIndicator': { max: 200, window: 60000 },
    'getShopConversations': { max: 50, window: 60000 },
    'uploadMedia': { max: 15, window: 60000 } // Rate limit for media uploads
  };

  return rateLimiter.isAllowed(
    userId,
    action,
    limits[action]?.max || 10,
    limits[action]?.window || 60000
  );
}

// Clean up rate limiter periodically
setInterval(() => {
  rateLimiter.cleanup();
}, 60000);

export const initializeChatSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: true,
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["websocket", "polling"],
    allowUpgrades: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    cookie: false,
    maxHttpBufferSize: MEDIA_CONFIG.MAX_FILE_SIZE, // Allow large file uploads
    allowRequest: async (req, callback) => {
      try {
        const token = req.headers.authorization?.split(' ')[1] ||
          req._query?.token ||
          req.cookies?.jwt;
        if (!token) return callback("No token provided", false);

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        } catch (err) {
          if (err.name === 'TokenExpiredError') {
            const refreshToken = req.cookies?.jwt;
            if (!refreshToken) return callback("No refresh token provided", false);

            const refreshDecoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            const user = await User.findById(refreshDecoded.id);
            if (!user || user.refreshToken !== refreshToken) {
              return callback("Invalid refresh token", false);
            }

            decoded = { id: user._id };
            const newAccessToken = jwt.sign(
              { id: user._id, email: user.email, role: user.role },
              process.env.JWT_ACCESS_SECRET,
              { expiresIn: '15m' }
            );
            req.newAccessToken = newAccessToken;
          } else {
            return callback(`Authentication error: ${err.message}`, false);
          }
        }

        const user = await User.findById(decoded.id);
        if (!user) return callback("User not found", false);

        req.user = user;
        callback(null, true);
      } catch (err) {
        callback(`Authentication error: ${err.message}`, false);
      }
    }
  });

  io.use((socket, next) => {
    const req = socket.request;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'Unknown';

    console.log(`Connection attempt from: ${req.headers.origin} | IP: ${ip} | User-Agent: ${userAgent}`);

    // Log suspicious connections
    if (!req.headers.origin || req.headers.origin === 'null') {
      console.warn(`Suspicious connection attempt - No origin: ${ip}`);
    }

    if (req.newAccessToken) {
      socket.emit("newAccessToken", req.newAccessToken);
    }
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.request.user;
    console.log(`Authenticated connection: ${user?.email}`);

    if (user) {
      socket.join(user._id.toString());
      console.log(`User ${user._id} joined their room`);
    }

    // NEW: Handle media file upload
    socket.on("uploadMedia", async (data, callback) => {
      try {
        const { fileBuffer, fileName, mimeType, conversationId } = data;

        // Rate limiting
        if (!checkRateLimit(user._id.toString(), 'uploadMedia')) {
          return callback({ 
            status: "error", 
            message: "Rate limit exceeded. Please wait before uploading another file." 
          });
        }

        // Input validation
        if (!fileBuffer || !fileName || !mimeType || !conversationId) {
          return callback({ 
            status: "error", 
            message: "File data, name, type, and conversation ID are required" 
          });
        }

        if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(conversationId)) {
          return callback({ status: "error", message: "Invalid conversation ID format" });
        }

        // Check conversation authorization
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.some(p => p._id.equals(user._id))) {
          return callback({ 
            status: "error", 
            message: "Not authorized to upload media to this conversation" 
          });
        }

        // Validate file
        const buffer = Buffer.from(fileBuffer);
        const validationResult = await validateMediaFile(buffer, mimeType, fileName);
        if (!validationResult.isValid) {
          return callback({ status: "error", message: validationResult.error });
        }

        // Generate thumbnail for videos
        let thumbnailUrl = null;
        if (validationResult.mediaType === 'video') {
          try {
            const thumbnailResult = await generateThumbnail(uploadResult.secure_url);
            thumbnailUrl = thumbnailResult.secure_url;
          } catch (thumbnailErr) {
            console.warn('Failed to generate video thumbnail:', thumbnailErr);
          }
        }

        const mediaData = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          fileName: fileName,
          mimeType: mimeType,
          size: buffer.length,
          mediaType: validationResult.mediaType,
          thumbnailUrl: thumbnailUrl,
          duration: validationResult.duration,
          dimensions: validationResult.dimensions
        };

        callback({ status: "success", media: mediaData });

      } catch (err) {
        console.error('Error uploading media:', err);
        callback({ status: "error", message: "Failed to upload media file" });
      }
    });

    // ENHANCED: Send media message
    socket.on("sendMediaMessage", async (data, callback) => {
      try {
        const { conversationId, mediaData, caption, productId } = data;

        // Rate limiting
        if (!checkRateLimit(user._id.toString(), 'sendMediaMessage')) {
          return callback({ 
            status: "error", 
            message: "Rate limit exceeded. Please wait before sending another media message." 
          });
        }

        // Input validation
        if (!conversationId || !mediaData) {
          return callback({ 
            status: "error", 
            message: "Conversation ID and media data are required" 
          });
        }

        if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(conversationId)) {
          return callback({ status: "error", message: "Invalid conversation ID format" });
        }

        // Validate media data structure
        const requiredFields = ['url', 'publicId', 'fileName', 'mimeType', 'size', 'mediaType'];
        const missingFields = requiredFields.filter(field => !mediaData[field]);
        if (missingFields.length > 0) {
          return callback({ 
            status: "error", 
            message: `Missing media data fields: ${missingFields.join(', ')}` 
          });
        }

        // Find conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return callback({ status: "error", message: "Conversation not found" });
        }
        
        // Check authorization
        if (!conversation.participants.some(p => p._id.equals(user._id))) {
          return callback({ 
            status: "error", 
            message: "Not authorized to send message in this conversation" 
          });
        }

        // Find receiver
        const receiverId = conversation.participants.find(p => !p._id.equals(user._id));

        // Sanitize caption if provided
        let sanitizedCaption = null;
        if (caption && typeof caption === 'string') {
          sanitizedCaption = sanitizeInput(caption.trim());
        }

        // Create media message
        const message = await Message.create({
          sender: user._id,
          receiver: receiverId,
          content: sanitizedCaption || `Sent a ${mediaData.mediaType}`,
          messageType: 'media',
          media: {
            url: mediaData.url,
            publicId: mediaData.publicId,
            fileName: mediaData.fileName,
            mimeType: mediaData.mimeType,
            size: mediaData.size,
            mediaType: mediaData.mediaType,
            thumbnailUrl: mediaData.thumbnailUrl,
            duration: mediaData.duration,
            dimensions: mediaData.dimensions,
            uploadedAt: new Date()
          },
          product: productId || conversation.product,
          conversation: conversationId
        });

        // Update conversation
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          updatedAt: new Date()
        });

        // Populate message
        const populatedMessage = await Message.findById(message._id)
          .populate("sender", "name email")
          .populate("receiver", "name email");

        // Broadcast to conversation room
        io.to(conversationId).emit("newMessage", populatedMessage);
        
        // Send to receiver's personal room
        if (receiverId) {
          io.to(receiverId.toString()).emit("newMessage", populatedMessage);
        }

        callback({ status: "success", message: populatedMessage });
        console.log(`Media message sent in conversation ${conversationId}`);
        
      } catch (err) {
        console.error('Error sending media message:', err);
        callback({ status: "error", message: err.message });
      }
    });

    // NEW: Delete media message
    socket.on("deleteMediaMessage", async ({ messageId }, callback) => {
      try {
        // Input validation
        if (!messageId || !SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(messageId)) {
          return callback({ status: "error", message: "Invalid message ID" });
        }

        const message = await Message.findById(messageId);
        if (!message) {
          return callback({ status: "error", message: "Message not found" });
        }

        // Check authorization (only sender can delete)
        if (!message.sender.equals(user._id)) {
          return callback({ 
            status: "error", 
            message: "Not authorized to delete this message" 
          });
        }

   

        // Mark message as deleted (soft delete to maintain conversation history)
        message.deleted = true;
        message.deletedAt = new Date();
        await message.save();

        // Broadcast deletion to conversation participants
        io.to(message.conversation.toString()).emit("messageDeleted", { 
          messageId,
          deletedBy: user._id 
        });

        callback({ status: "success" });

      } catch (err) {
        console.error('Error deleting media message:', err);
        callback({ status: "error", message: err.message });
      }
    });

    // Existing handlers with modifications...
    socket.on("createConversation", async ({ productId, participantId }, callback) => {
      try {
        // Rate limiting
        if (!rateLimiter.isAllowed(
          user._id.toString(),
          'createConversation',
          SOCKET_SECURITY_CONFIG.RATE_LIMITS.createConversation.max,
          SOCKET_SECURITY_CONFIG.RATE_LIMITS.createConversation.window
        )) {
          return callback({ status: "error", message: "Rate limit exceeded. Please wait before creating another conversation." });
        }

        // Input validation and sanitization
        if (!productId || !participantId) {
          return callback({ status: "error", message: "Product ID and participant ID are required" });
        }

        if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(productId)) {
          return callback({ status: "error", message: "Invalid product ID format" });
        }

        if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(participantId)) {
          return callback({ status: "error", message: "Invalid participant ID format" });
        }

        const participant = await User.findById(participantId);
        if (!participant) {
          return callback({ status: "error", message: "Participant not found" });
        }

        if (participant._id.equals(user._id)) {
          return callback({ status: "error", message: "Cannot create conversation with yourself" });
        }

        const existingConversation = await Conversation.findOne({
          product: productId,
          participants: { $all: [user._id, participant._id] }
        });

        if (existingConversation) {
          return callback({ status: "success", conversationId: existingConversation._id });
        }

        const conversation = await Conversation.create({
          participants: [user._id, participant._id],
          product: productId
        });

        socket.join(conversation._id.toString());
        io.to(participant._id.toString()).emit("newConversation", { conversationId: conversation._id });
        callback({ status: "success", conversationId: conversation._id });
      } catch (err) {
        callback({ status: "error", message: err.message });
      }
    });

    socket.on("joinConversation", async ({ conversationId }, callback) => {
      try {
        // Rate limiting
        if (!rateLimiter.isAllowed(
          user._id.toString(),
          'joinConversation',
          SOCKET_SECURITY_CONFIG.RATE_LIMITS.joinConversation.max,
          SOCKET_SECURITY_CONFIG.RATE_LIMITS.joinConversation.window
        )) {
          return callback({ status: "error", message: "Rate limit exceeded. Please wait before joining another conversation." });
        }

        // Input validation
        if (!conversationId) {
          return callback({ status: "error", message: "Conversation ID is required" });
        }

        if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(conversationId)) {
          return callback({ status: "error", message: "Invalid conversation ID format" });
        }

        const conversation = await Conversation.findById(conversationId)
          .populate("participants", "name email")
          .populate("lastMessage");
        if (!conversation) {
          return callback({ status: "error", message: "Conversation not found" });
        }
        if (!conversation.participants.some(p => p._id.equals(user._id))) {
          return callback({ status: "error", message: "Not authorized to join this conversation" });
        }
        socket.join(conversation._id.toString());
        callback({ status: "success", conversation });
      } catch (err) {
        callback({ status: "error", message: err.message });
      }
    });

    socket.on("getConversations", async (callback) => {
      try {
        const conversations = await Conversation.find({ participants: user._id })
          .populate("participants", "name email")
          .populate("lastMessage")
          .sort({ updatedAt: -1 });
        callback({ status: "success", conversations });
      } catch (err) {
        callback({ status: "error", message: err.message });
      }
    });

    socket.on("getMessages", async ({ conversationId, limit = 20, skip = 0 }, callback) => {
      try {
        // Rate limiting
        if (!rateLimiter.isAllowed(
          user._id.toString(),
          'getMessages',
          SOCKET_SECURITY_CONFIG.RATE_LIMITS.getMessages.max,
          SOCKET_SECURITY_CONFIG.RATE_LIMITS.getMessages.window
        )) {
          return callback({ status: "error", message: "Rate limit exceeded. Please wait before requesting more messages." });
        }

        // Input validation
        if (!conversationId) {
          return callback({ status: "error", message: "Conversation ID is required" });
        }

        if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(conversationId)) {
          return callback({ status: "error", message: "Invalid conversation ID format" });
        }

        // Sanitize pagination parameters
        const sanitizedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100); // Max 100 messages per request
        const sanitizedSkip = Math.max(parseInt(skip) || 0, 0);

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return callback({ status: "error", message: "Conversation not found" });
        }
        if (!conversation.participants.some(p => p._id.equals(user._id))) {
          return callback({ status: "error", message: "Not authorized to view messages" });
        }
        
        // Exclude deleted messages from regular queries
        const messages = await Message.find({ 
          conversation: conversationId,
          deleted: { $ne: true }
        })
          .populate("sender", "name email")
          .populate("receiver", "name email")
          .sort({ createdAt: -1 })
          .skip(sanitizedSkip)
          .limit(sanitizedLimit);
          
        callback({ status: "success", messages });
      } catch (err) {
        callback({ status: "error", message: err.message });
      }
    });

    socket.on("sendMessage", async ({ conversationId, content, productId }, callback) => {
      try {
        // Rate limiting
        if (!checkRateLimit(user._id.toString(), 'sendMessage')) {
          return callback({ status: "error", message: "Rate limit exceeded. Please wait before sending another message." });
        }

        // Input validation
        if (!conversationId) {
          return callback({ status: "error", message: "Conversation ID is required" });
        }

        if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(conversationId)) {
          return callback({ status: "error", message: "Invalid conversation ID format" });
        }

        if (!content || typeof content !== 'string') {
          return callback({ status: "error", message: "Message content is required" });
        }

        // Sanitize message content
        const sanitizedContent = sanitizeInput(content);
        if (!sanitizedContent) {
          return callback({ status: "error", message: "Message content cannot be empty after sanitization" });
        }

        // Find conversation
        let conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return callback({ status: "error", message: "Conversation not found" });
        }
        
        // Check authorization
        if (!conversation.participants.some(p => p._id.equals(user._id))) {
          return callback({ status: "error", message: "Not authorized to send message in this conversation" });
        }

        // Find receiver
        const receiverId = conversation.participants.find(p => !p._id.equals(user._id));

        // Create message
        const message = await Message.create({
          sender: user._id,
          receiver: receiverId,
          content: sanitizedContent,
          messageType: 'text', // Explicitly set message type
          product: productId || conversation.product,
          conversation: conversationId
        });

        // Update conversation
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          updatedAt: new Date()
        });

        // Populate message
        const populatedMessage = await Message.findById(message._id)
          .populate("sender", "name email")
          .populate("receiver", "name email");

        // Broadcast to conversation room
        io.to(conversationId).emit("newMessage", populatedMessage);
        
        // Send to receiver's personal room (in case they're not in conversation room)
        if (receiverId) {
          io.to(receiverId.toString()).emit("newMessage", populatedMessage);
        }

        callback({ status: "success", message: populatedMessage });
        console.log(`Message sent in conversation ${conversationId}`);
        
      } catch (err) {
        console.error('Error sending message:', err);
        callback({ status: "error", message: err.message });
      }
    });

    socket.on("markAsRead", async ({ messageId }, callback) => {
      try {
        // Rate limiting
        if (!rateLimiter.isAllowed(
          user._id.toString(),
          'markAsRead',
          SOCKET_SECURITY_CONFIG.RATE_LIMITS.markAsRead.max,
          SOCKET_SECURITY_CONFIG.RATE_LIMITS.markAsRead.window
        )) {
          return callback({ status: "error", message: "Rate limit exceeded. Please wait before marking more messages as read." });
        }

        // Input validation
        if (!messageId) {
          return callback({ status: "error", message: "Message ID is required" });
        }

        // Validate message ID format (24 character hex string)
        if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(messageId)) {
          return callback({ status: "error", message: "Invalid message ID format" });
        }

        const message = await Message.findById(messageId);
        if (!message) {
          return callback({ status: "error", message: "Message not found" });
        }
        if (!message.receiver.equals(user._id)) {
          return callback({ status: "error", message: "Not authorized to mark this message as read" });
        }
        message.read = true;
        await message.save();
        io.to(message.sender.toString()).emit("messageRead", { messageId });
        callback({ status: "success" });
      } catch (err) {
        callback({ status: "error", message: err.message });
      }
    });

    socket.on("createShopConversation", async ({ productId, shopOwnerId }, callback) => {
      try {
        console.log(`Creating shop conversation: productId=${productId}, shopOwnerId=${shopOwnerId}, userId=${user._id}`);
        
        // Rate limiting
        if (!checkRateLimit(user._id.toString(), 'createShopConversation')) {
          return callback({ status: "error", message: "Rate limit exceeded. Please wait before creating another conversation." });
        }

        // Input validation
        if (!productId || !shopOwnerId) {
          return callback({ status: "error", message: "Product ID and shop owner ID are required" });
        }

        if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(productId)) {
          return callback({ status: "error", message: "Invalid product ID format" });
        }

        if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(shopOwnerId)) {
          return callback({ status: "error", message: "Invalid shop owner ID format" });
        }

        // Check if trying to chat with yourself
        if (shopOwnerId === user._id.toString()) {
          return callback({ status: "error", message: "Cannot create conversation with yourself" });
        }

        // Find shop owner
        const shopOwner = await User.findById(shopOwnerId);
        if (!shopOwner) {
          return callback({ status: "error", message: "Shop owner not found" });
        }

        // Check for existing conversation
        const existingConversation = await Conversation.findOne({
          participants: { $all: [user._id, shopOwnerId] },
          product: productId,
          type: "shop_chat"
        });

        if (existingConversation) {
          socket.join(existingConversation._id.toString());
          return callback({ status: "success", conversationId: existingConversation._id });
        }

        // Create new shop conversation
        const conversation = await Conversation.create({
          participants: [user._id, shopOwnerId],
          product: productId,
          type: "shop_chat",
          createdBy: user._id
        });

        socket.join(conversation._id.toString());
        
        // Notify shop owner
        io.to(shopOwnerId).emit("newShopConversation", { 
          conversationId: conversation._id,
          customer: {
            _id: user._id,
            name: user.name,
            email: user.email
          },
          productId: productId
        });

        callback({ status: "success", conversationId: conversation._id });
        console.log(`Shop conversation created: ${conversation._id}`);
        
      } catch (err) {
        console.error('Error creating shop conversation:', err);
        callback({ status: "error", message: err.message });
      }
    });

    // Add TYPING INDICATOR handler
    socket.on("sendTypingIndicator", async ({ conversationId, isTyping }, callback) => {
      try {
        // Rate limiting
        if (!checkRateLimit(user._id.toString(), 'sendTypingIndicator')) {
          return; // Just ignore if rate limited, don't send error
        }

        // Input validation
        if (!conversationId || !SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(conversationId)) {
          return; // Just ignore invalid requests
        }

        // Check if user is participant
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.some(p => p._id.equals(user._id))) {
          return; // Just ignore unauthorized requests
        }

        // Broadcast typing status to other participants in the conversation
        socket.to(conversationId).emit("userTyping", {
          userId: user._id,
          userName: user.name,
          isTyping: Boolean(isTyping)
        });

        if (callback && typeof callback === 'function') {
          callback({ status: "success" });
        }
        
      } catch (err) {
        console.error('Error handling typing indicator:', err);
        if (callback && typeof callback === 'function') {
          callback({ status: "error", message: err.message });
        }
      }
    });

    // Add GET SHOP CONVERSATIONS handler
    socket.on("getShopConversations", async ({ shopId }, callback) => {
      try {
        // Rate limiting
        if (!checkRateLimit(user._id.toString(), 'getShopConversations')) {
          return callback({ status: "error", message: "Rate limit exceeded." });
        }

        // Input validation
        if (shopId && !SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(shopId)) {
          return callback({ status: "error", message: "Invalid shop ID format" });
        }

        let query = { participants: user._id, type: "shop_chat" };
        if (shopId) {
          query.shop = shopId;
        }

        const conversations = await Conversation.find(query)
          .populate("participants", "name email")
          .populate("lastMessage")
          .populate("shop", "name logoUrl")
          .populate("product", "title name")
          .sort({ updatedAt: -1 });

        callback({ status: "success", conversations });
        
      } catch (err) {
        console.error('Error getting shop conversations:', err);
        callback({ status: "error", message: err.message });
      }
    });

    socket.on("ping", (cb) => {
      if (typeof cb === "function") cb();
    });

    socket.on("disconnect", (reason) => {
      console.log(`Disconnected: ${reason}`);
      if (reason === "ping timeout" || reason === "transport close") {
        console.log(`Attempting to reconnect for user: ${user?.email}`);
      }
    });

    socket.on("error", (err) => {
      console.error(`Socket error for user ${user?.email}:`, err);
    });

    // Security monitoring
    socket.onAny((eventName, ...args) => {
      // Log all events for security monitoring
      if (eventName !== 'ping' && eventName !== 'pong') {
        console.log(`Event: ${eventName} | User: ${user?.email} | Args: ${JSON.stringify(args)}`);
      }
    });

    socket.on("reconnect_attempt", () => {
      console.log(`Reconnection attempt for user: ${user?.email}`);
    });

    socket.on("reconnect", () => {
      console.log(`Reconnected: ${user?.email}`);
      if (user) {
        socket.join(user._id.toString());
      }
    });
  });

  setInterval(() => {
    io.emit("heartbeat", Date.now());
  }, 25000);

  return io;
};

export const getChatIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};