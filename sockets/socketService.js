import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { Message, Conversation } from "../models/chatModel.js";

let io;

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
    console.log(`Connection attempt from: ${req.headers.origin}`);
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
        if (!productId || !participantId) {
          return callback({ status: "error", message: "Product ID and participant ID are required" });
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
        const conversation = await Conversation.findById(conversationId)
          .populate("participants", "name email")
          .populate("lastMessage");
        if (!conversation) {
          return callback({ status: "error", message: "Conversation not found" });
        }
        if (!conversation.participants.some(p => p._id.equals(user._id))) {
          return callback({ status: "error", message: "Not authorized to joint this conversation" });
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
          .skip(skip)
          .limit(limit);
        callback({ status: "success", messages });
      } catch (err) {
        callback({ status: "error", message: err.message });
      }
    });

    socket.on("sendMessage", async ({ conversationId, content, productId }, callback) => {
      try {
        let conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return callback({ status: "error", message: "Conversation not found" });
        }
        if (!conversation.participants.some(p => p._id.equals(user._id))) {
          return callback({ status: "error", message: "Not authorized to send message in this conversation" });
        }

        const message = await Message.create({
          sender: user._id,
          receiver: conversation.participants.find(p => !p._id.equals(user._id)),
          content,
          product: productId || conversation.product,
          conversation: conversationId
        });

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          updatedAt: new Date()
        });

        const populatedMessage = await Message.findById(message._id)
          .populate("sender", "name email")
          .populate("receiver", "name email");

        io.to(conversation._id.toString()).emit("newMessage", populatedMessage);
        callback({ status: "success", message: populatedMessage });
      } catch (err) {
        callback({ status: "error", message: err.message });
      }
    });

    socket.on("markAsRead", async ({ messageId }, callback) => {
      try {
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
      console.error("Socket error:", err);
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