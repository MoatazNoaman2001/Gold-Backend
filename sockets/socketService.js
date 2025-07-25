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

let io;
const rateLimiter = new RateLimiter();
const connectionMonitor = new ConnectionMonitor();

function checkRateLimit(userId, action) {
  const limits = {
    'createShopConversation': { max: 10, window: 60000 },
    'createConversation': { max: 10, window: 60000 },
    'sendMessage': { max: 50, window: 60000 },
    'joinConversation': { max: 20, window: 60000 },
    'getMessages': { max: 100, window: 60000 },
    'markAsRead': { max: 100, window: 60000 },
    'sendTypingIndicator': { max: 200, window: 60000 },
    'getShopConversations': { max: 50, window: 60000 }
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
        const messages = await Message.find({ conversation: conversationId })
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